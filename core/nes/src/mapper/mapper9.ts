import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * iNES Mapper 9 — MMC2。
 * $A000 切 $8000 的 8KB PRG，后 24KB 固定。
 * 左右图案各两套 4KB，读到 FD/FE 触发地址后才锁存，当前这次读取仍用旧 bank。
 */
export class Mapper9 implements Mapper{
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private prgBank=0;
  private prgCount:number;
  private chrCount:number;
  private chrFd0=0;
  private chrFe0=0;
  private chrFd1=0;
  private chrFe1=0;
  private latch0=0;
  private latch1=0;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.prgCount=Math.max(1,cartridge.romNum*2);
    this.prgBank=0;
    this.chrFd0=0;
    this.chrFe0=0;
    this.chrFd1=0;
    this.chrFe1=0;
    this.latch0=0;
    this.latch1=0;
    if(!hasVrom){
      this.chRam=new Uint8Array(8192);
      this.vromUint8Array=null;
      this.chrCount=1;
    }else{
      this.chRam=null;
      this.vromUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.vromOffset);
      this.chrCount=Math.max(1,cartridge.vromNum*2);
    }
  }

  public cpuReadRpg(busAddress:number):number{
    let bank:number;
    if(busAddress<0xa000) bank=this.prgBank;
    else if(busAddress<0xc000) bank=this.prgCount-3;
    else if(busAddress<0xe000) bank=this.prgCount-2;
    else bank=this.prgCount-1;
    if(bank<0) bank=0;
    return this.rpgUint8Array[(bank%this.prgCount)*0x2000+(busAddress&0x1fff)];
  }

  public cpuWriteRpg(busAddress:number,value:number):void{
    const reg=busAddress&0xf000;
    const bank=value&0x1f;
    if(reg===0xa000) this.prgBank=bank;
    else if(reg===0xb000) this.chrFd0=bank;
    else if(reg===0xc000) this.chrFe0=bank;
    else if(reg===0xd000) this.chrFd1=bank;
    else if(reg===0xe000) this.chrFe1=bank;
    else if(reg===0xf000){
      this.nametableMirror=(value&1)?NametableType.HORIZONTAL:NametableType.VIRTICAL;
    }
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
  }

  public ppuReadPt(busAddress:number):number{
    const a=busAddress&0x1fff;
    const latched=a<0x1000
      ?(this.latch0===0?this.chrFd0:this.chrFe0)
      :(this.latch1===0?this.chrFd1:this.chrFe1);
    let value:number;
    if(!this.vromUint8Array){
      value=this.chRam[a];
    }else{
      const bank=latched%this.chrCount;
      value=this.vromUint8Array[bank*0x1000+(a&0x0fff)];
    }
    if(a>=0x0fd8&&a<=0x0fdf) this.latch0=0;
    else if(a>=0x0fe8&&a<=0x0fef) this.latch0=1;
    else if(a>=0x1fd8&&a<=0x1fdf) this.latch1=0;
    else if(a>=0x1fe8&&a<=0x1fef) this.latch1=1;
    return value;
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(!this.vromUint8Array){
      this.chRam[busAddress&0x1fff]=value;
    }
  }
}
