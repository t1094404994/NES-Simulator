import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * iNES Mapper 4 — MMC3 / TxROM
 * PRG/CHR banking、mirroring、WRAM、扫描线 IRQ
 */
export class Mapper4 implements Mapper{
  private chRamPtr:ArrayBuffer;
  private chRamPtrUint8Array:Uint8Array;
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private cartridge:CartridgeReader;
  public nametableMirror:number;

  public addRam:ArrayBuffer;
  public addRamDataView:Uint8Array;

  private bankSelect:number;
  protected bankRegs:number[];
  private prgMode:number;
  protected chrMode:number;
  /** 名称表由 CHR bank bit7 决定，忽略 $A000 镜像位（mapper 118） */
  protected chrNametable=false;
  private wramEnable:boolean;
  private wramWriteProtect:boolean;

  private irqLatch:number;
  private irqCounter:number;
  private irqReload:boolean;
  private irqEnable:boolean;
  private tryIrq:(()=>void)|null;
  private clearIrq:(()=>void)|null;

  private prgBankCount:number;
  private chrBankCount1k:number;
  /** 晶科泰 1MB MMC3：$5000 bit2 选择高 512KB；未写入前保持标准 MMC3 */
  private prgOuter:number;
  private useOuterBanking:boolean;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.tryIrq=null;
    this.clearIrq=null;
    this.reset(cartridge,hasVrom);
  }

  public reset(_cartridge:CartridgeReader,hasVrom:boolean):void{
    if(!hasVrom){
      this.chRamPtr=new ArrayBuffer(8192);
      this.chRamPtrUint8Array=new Uint8Array(this.chRamPtr);
    }else{
      this.chRamPtr=null;
      this.chRamPtrUint8Array=null;
    }
    this.cartridge=_cartridge;
    this.rpgUint8Array=new Uint8Array(
      this.cartridge.cartridgeData,
      this.cartridge.programOffset,
      this.cartridge.romNum*16384
    );
    this.vromUint8Array=new Uint8Array(this.cartridge.cartridgeData,this.cartridge.vromOffset);

    this.addRam=new ArrayBuffer(0x2000);
    this.addRamDataView=new Uint8Array(this.addRam);

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
    this.prgOuter=0;
    this.useOuterBanking=false;

    this.prgBankCount=Math.max(2,this.cartridge.romNum*2);
    this.chrBankCount1k=hasVrom?Math.max(8,this.cartridge.vromNum*8):8;
  }

  public bindIrq(tryIrq:()=>void,clearIrq?:()=>void):void{
    this.tryIrq=tryIrq;
    this.clearIrq=clearIrq||null;
  }

  /**
   * MMC3 IRQ 计数器时钟。
   * 扫描线渲染器上应由 PPU 每条可见/预渲染扫描线调用一次（约 cycle 260），
   * 不可对每个 CHR 读都调用，否则会 IRQ 风暴（SMB3 表现为栈被推爆）。
   */
  public notifyA12Rise():void{
    if(this.irqCounter===0||this.irqReload){
      this.irqCounter=this.irqLatch;
    }else{
      this.irqCounter--;
    }
    this.irqReload=false;

    if(this.irqCounter===0&&this.irqEnable){
      this.tryIrq?.();
    }
  }

  private mapPrg8k(bank:number,offset:number):number{
    const b=((bank%this.prgBankCount)+this.prgBankCount)%this.prgBankCount;
    return b*0x2000+(offset&0x1fff);
  }

  private mapChr1k(bank:number,offset:number):number{
    const b=((bank%this.chrBankCount1k)+this.chrBankCount1k)%this.chrBankCount1k;
    return b*0x400+(offset&0x3ff);
  }

  /** 晶科泰：$5000=0/4 选择 512KB 窗口；标准 MMC3 不写此寄存器 */
  public cpuWriteExp(busAddress:number,value:number):void{
    if((busAddress&0xf000)!==0x5000){
      return;
    }
    this.useOuterBanking=true;
    this.prgOuter=(value&0x04)?0x40:0;
  }

  private effectivePrgBank(bank:number):number{
    if(this.useOuterBanking){
      return this.prgOuter|(bank&0x3f);
    }
    return bank;
  }

  private prgFixedLast():number{
    if(this.useOuterBanking){
      return this.prgOuter|0x3f;
    }
    return this.prgBankCount-1;
  }

  private prgFixedSecondLast():number{
    return this.prgFixedLast()-1;
  }

  public cpuReadRpg(busAddress:number):number{
    const last=this.prgFixedLast();
    const secondLast=this.prgFixedSecondLast();
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
    return this.rpgUint8Array[this.mapPrg8k(this.effectivePrgBank(bank),busAddress)];
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
          v&=0xfe; // 2KB CHR 窗口忽略最低位
        }
        // PRG：原版 MMC3 仅 6bit（≤512KB）。汉化/1MB 卡（如 dq-cn/ff3-cn）需要更高位，
        // 最终由 mapPrg8k 按 prgBankCount 取模，这里不再强行 & 0x3f。
        this.bankRegs[this.bankSelect]=v;
      }
    }else if(busAddress<0xc000){
      if(even){
        if(!this.chrNametable){
          this.nametableMirror=(value&1)
            ?NametableType.HORIZONTAL
            :NametableType.VIRTICAL;
        }
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
    }else if(even){
      // $E000：禁止 IRQ 并应答挂起中断
      this.irqEnable=false;
      this.clearIrq?.();
    }else{
      // $E001：允许 IRQ（不应答）
      this.irqEnable=true;
    }
  }

  public cpuReadAddRom(busAddress:number):number{
    if(!this.wramEnable){
      return 0;
    }
    return this.addRamDataView[busAddress-0x6000];
  }

  public cpuWriteAddRom(busAddress:number,value:number):void{
    if(!this.wramEnable||this.wramWriteProtect){
      return;
    }
    this.addRamDataView[busAddress-0x6000]=value;
  }

  public ppuReadPt(busAddress:number):number{
    // CHR ROM/RAM 都走 bank 映射；纯 CHR RAM 的汉化 MMC3 依赖此行为
    const addr=this.chrAddress(busAddress);
    if(this.cartridge.vromNum===0){
      return this.chRamPtrUint8Array[addr%this.chRamPtr.byteLength];
    }
    return this.vromUint8Array[addr];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(this.cartridge.vromNum===0){
      const addr=this.chrAddress(busAddress);
      this.chRamPtrUint8Array[addr%this.chRamPtr.byteLength]=value;
    }
  }

  private chrAddress(busAddress:number):number{
    const a=busAddress&0x1fff;
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
