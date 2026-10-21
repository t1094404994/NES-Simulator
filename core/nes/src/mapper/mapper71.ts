import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * iNES Mapper 71 — Camerica。
 * $C000+ 切 $8000 的 16KB PRG，$C000 固定最后一 bank。
 * $9000 bit4 切单屏（Fire Hawk）。
 */
export class Mapper71 implements Mapper{
  private rpgUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private prgBank=0;
  private prgCount:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,_hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.chRam=new Uint8Array(8192);
    this.prgCount=Math.max(1,cartridge.romNum);
    this.prgBank=0;
    this.nametableMirror=NametableType.HORIZONTAL;
  }

  public cpuReadRpg(busAddress:number):number{
    const bank=busAddress<0xc000?this.prgBank%this.prgCount:this.prgCount-1;
    return this.rpgUint8Array[bank*0x4000+(busAddress&0x3fff)];
  }

  public cpuWriteRpg(busAddress:number,value:number):void{
    if(busAddress>=0x9000&&busAddress<0xa000){
      this.nametableMirror=(value&0x10)
        ?NametableType.ONESCREEN_HIGHER
        :NametableType.ONESCREEN_LOWER;
      return;
    }
    if(busAddress>=0xc000){
      this.prgBank=value&(this.prgCount-1);
    }
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
  }

  public ppuReadPt(busAddress:number):number{
    return this.chRam[busAddress&0x1fff];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    this.chRam[busAddress&0x1fff]=value;
  }
}
