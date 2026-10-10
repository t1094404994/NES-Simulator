import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * iNES Mapper 4 — MMC3 / TxROM
 * PRG/CHR banking、mirroring、WRAM、A12 scanline IRQ
 */
export class Mapper4 implements Mapper{
  private chRamPtr:ArrayBuffer;
  private chRamPtrDataView:DataView;
  private rpgDataView:DataView;
  private vromDataView:DataView;
  private cartridge:CartridgeReader;
  public nametableMirror:number;

  public addRam:ArrayBuffer;
  public addRamDataView:DataView;

  private bankSelect:number;
  private bankRegs:number[];
  private prgMode:number;
  private chrMode:number;
  private wramEnable:boolean;
  private wramWriteProtect:boolean;

  private irqLatch:number;
  private irqCounter:number;
  private irqReload:boolean;
  private irqEnable:boolean;
  private tryIrq:(()=>void)|null;

  private prgBankCount:number;
  private chrBankCount1k:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.tryIrq=null;
    this.reset(cartridge,hasVrom);
  }

  public reset(_cartridge:CartridgeReader,hasVrom:boolean):void{
    if(!hasVrom){
      this.chRamPtr=new ArrayBuffer(8192);
      this.chRamPtrDataView=new DataView(this.chRamPtr);
    }else{
      this.chRamPtr=null;
      this.chRamPtrDataView=null;
    }
    this.cartridge=_cartridge;
    this.rpgDataView=new DataView(
      this.cartridge.cartridgeData,
      this.cartridge.programOffset,
      this.cartridge.romNum*16384
    );
    this.vromDataView=new DataView(this.cartridge.cartridgeData,this.cartridge.vromOffset);

    this.addRam=new ArrayBuffer(0x2000);
    this.addRamDataView=new DataView(this.addRam);

    this.bankSelect=0;
    this.bankRegs=[0,2,4,5,6,7,0,1];
    this.prgMode=0;
    this.chrMode=0;
    this.wramEnable=true;
    this.wramWriteProtect=false;
    this.irqLatch=0;
    this.irqCounter=0;
    this.irqReload=false;
    this.irqEnable=false;
    this.nametableMirror=NametableType.VIRTICAL;

    // romNum = 16KB banks → 8KB bank count = romNum * 2
    this.prgBankCount=Math.max(2,this.cartridge.romNum*2);
    // vromNum = 8KB banks → 1KB bank count = vromNum * 8
    this.chrBankCount1k=hasVrom?Math.max(8,this.cartridge.vromNum*8):8;
  }

  public bindIrq(tryIrq:()=>void):void{
    this.tryIrq=tryIrq;
  }

  public notifyA12Rise():void{
    if(this.irqCounter===0||this.irqReload){
      this.irqCounter=this.irqLatch;
    }else{
      this.irqCounter--;
    }
    if(this.irqCounter===0&&this.irqEnable){
      this.tryIrq?.();
    }
    this.irqReload=false;
  }

  private mapPrg8k(bank:number,offset:number):number{
    const b=((bank%this.prgBankCount)+this.prgBankCount)%this.prgBankCount;
    return b*0x2000+(offset&0x1fff);
  }

  private mapChr1k(bank:number,offset:number):number{
    const b=((bank%this.chrBankCount1k)+this.chrBankCount1k)%this.chrBankCount1k;
    return b*0x400+(offset&0x3ff);
  }

  public cpuReadRpg(busAddress:number):number{
    const last=this.prgBankCount-1;
    const secondLast=this.prgBankCount-2;
    let bank:number;
    if(busAddress<0xa000){
      bank=this.prgMode===0?this.bankRegs[6]:secondLast;
    }else if(busAddress<0xc000){
      bank=this.bankRegs[7];
    }else if(busAddress<0xe000){
      bank=this.prgMode===0?secondLast:this.bankRegs[6];
    }else{
      bank=last;
    }
    return this.rpgDataView.getUint8(this.mapPrg8k(bank,busAddress));
  }

  public cpuWriteRpg(busAddress:number,value:number):void{
    const even=(busAddress&1)===0;
    if(busAddress<0xa000){
      if(even){
        this.bankSelect=value&7;
        this.prgMode=(value>>6)&1;
        this.chrMode=(value>>7)&1;
      }else{
        let v=value;
        if(this.bankSelect===0||this.bankSelect===1){
          v&=0xfe; // 2KB CHR banks ignore low bit
        }
        if(this.bankSelect===6||this.bankSelect===7){
          v&=0x3f; // PRG bank low 6 bits
        }
        this.bankRegs[this.bankSelect]=v;
      }
    }else if(busAddress<0xc000){
      if(even){
        // 0 = vertical, 1 = horizontal (Nesdev MMC3)
        this.nametableMirror=(value&1)
          ?NametableType.HORIZONTAL
          :NametableType.VIRTICAL;
      }else{
        this.wramEnable=((value>>7)&1)===1;
        this.wramWriteProtect=((value>>6)&1)===1;
      }
    }else if(busAddress<0xe000){
      if(even){
        this.irqLatch=value;
      }else{
        this.irqReload=true;
      }
    }else{
      if(even){
        this.irqEnable=false;
      }else{
        this.irqEnable=true;
      }
    }
  }

  public cpuReadAddRom(busAddress:number):number{
    if(!this.wramEnable){
      return 0;
    }
    return this.addRamDataView.getUint8(busAddress-0x6000);
  }

  public cpuWriteAddRom(busAddress:number,value:number):void{
    if(!this.wramEnable||this.wramWriteProtect){
      return;
    }
    this.addRamDataView.setUint8(busAddress-0x6000,value);
  }

  public ppuReadPt(busAddress:number):number{
    if(this.cartridge.vromNum===0){
      return this.chRamPtrDataView.getUint8(busAddress&0x1fff);
    }
    const addr=this.chrAddress(busAddress);
    return this.vromDataView.getUint8(addr);
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(this.cartridge.vromNum===0){
      this.chRamPtrDataView.setUint8(busAddress&0x1fff,value);
    }
  }

  private chrAddress(busAddress:number):number{
    const a=busAddress&0x1fff;
    // 2KB 窗口：R0/R1 低位已清零，覆盖 bank 与 bank+1
    const map2k=(reg:number,offset:number)=>
      this.mapChr1k(reg+((offset>>10)&1),offset);

    if(this.chrMode===0){
      if(a<0x800){
        return map2k(this.bankRegs[0],a);
      }
      if(a<0x1000){
        return map2k(this.bankRegs[1],a);
      }
      if(a<0x1400){
        return this.mapChr1k(this.bankRegs[2],a);
      }
      if(a<0x1800){
        return this.mapChr1k(this.bankRegs[3],a);
      }
      if(a<0x1c00){
        return this.mapChr1k(this.bankRegs[4],a);
      }
      return this.mapChr1k(this.bankRegs[5],a);
    }
    // CHR mode 1: 1KB at $0000–$0FFF，2KB at $1000/$1800
    if(a<0x400){
      return this.mapChr1k(this.bankRegs[2],a);
    }
    if(a<0x800){
      return this.mapChr1k(this.bankRegs[3],a);
    }
    if(a<0xc00){
      return this.mapChr1k(this.bankRegs[4],a);
    }
    if(a<0x1000){
      return this.mapChr1k(this.bankRegs[5],a);
    }
    if(a<0x1800){
      return map2k(this.bankRegs[0],a);
    }
    return map2k(this.bankRegs[1],a);
  }
}
