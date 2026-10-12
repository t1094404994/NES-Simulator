import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/** iNES Mapper 7 — AxROM：32KB PRG bank；bit4 单屏 mirroring */
export class Mapper7 implements Mapper{
  private chRamPtr:ArrayBuffer;
  private chRamPtrDataView:DataView;
  private rpgDataView:DataView;
  private cartridge:CartridgeReader;
  public nametableMirror:number;
  private prgBank:number;
  private prgBankMask:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(_cartridge:CartridgeReader,_hasVrom:boolean):void{
    // AxROM 通常使用 CHR RAM
    this.chRamPtr=new ArrayBuffer(8192);
    this.chRamPtrDataView=new DataView(this.chRamPtr);
    this.cartridge=_cartridge;
    this.rpgDataView=new DataView(
      this.cartridge.cartridgeData,
      this.cartridge.programOffset,
      this.cartridge.romNum*16384
    );
    // romNum 以 16KB 计；32KB bank 数为 romNum/2
    const banks=Math.max(1,this.cartridge.romNum>>1);
    this.prgBankMask=banks-1;
    this.prgBank=0;
    this.nametableMirror=NametableType.ONESCREEN_LOWER;
  }

  public cpuReadRpg(busAddress:number):number{
    const addr=this.prgBank*0x8000+(busAddress&0x7fff);
    return this.rpgDataView.getUint8(addr);
  }

  public cpuWriteRpg(_busAddress:number,value:number):void{
    this.prgBank=value&this.prgBankMask;
    // bit4: 0 = 单屏 $2000，1 = 单屏 $2400
    this.nametableMirror=(value&0x10)
      ?NametableType.ONESCREEN_HIGHER
      :NametableType.ONESCREEN_LOWER;
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
  }

  public ppuReadPt(busAddress:number):number{
    return this.chRamPtrDataView.getUint8(busAddress&0x1fff);
  }

  public ppuWritePt(busAddress:number,value:number):void{
    this.chRamPtrDataView.setUint8(busAddress&0x1fff,value);
  }
}
