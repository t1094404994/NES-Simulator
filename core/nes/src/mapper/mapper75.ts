import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/** iNES Mapper 75 — VRC1：三段 8KB PRG，两段 4KB CHR，镜像。没有 IRQ */
export class Mapper75 implements Mapper{
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private prg:[number,number,number]=[0,0,0];
  private chr:[number,number]=[0,0];
  private chrHi:[number,number]=[0,0];
  private prgCount:number;
  private chrCount:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.prgCount=Math.max(1,cartridge.romNum*2);
    this.prg=[0,0,0];
    this.chr=[0,0];
    this.chrHi=[0,0];
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
    if(busAddress<0xa000) bank=this.prg[0];
    else if(busAddress<0xc000) bank=this.prg[1];
    else if(busAddress<0xe000) bank=this.prg[2];
    else bank=this.prgCount-1;
    return this.rpgUint8Array[(bank%this.prgCount)*0x2000+(busAddress&0x1fff)];
  }

  public cpuWriteRpg(busAddress:number,value:number):void{
    const reg=busAddress&0xf000;
    if(reg===0x8000) this.prg[0]=value&0x0f;
    else if(reg===0xa000) this.prg[1]=value&0x0f;
    else if(reg===0xc000) this.prg[2]=value&0x0f;
    else if(reg===0x9000){
      this.nametableMirror=(value&1)?NametableType.HORIZONTAL:NametableType.VIRTICAL;
      this.chrHi[0]=(value>>1)&1;
      this.chrHi[1]=(value>>2)&1;
    }else if(reg===0xe000){
      this.chr[0]=value&0x0f;
    }else if(reg===0xf000){
      this.chr[1]=value&0x0f;
    }
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
  }

  private chrBank(index:number):number{
    return ((this.chrHi[index]<<4)|this.chr[index])%this.chrCount;
  }

  public ppuReadPt(busAddress:number):number{
    const a=busAddress&0x1fff;
    if(!this.vromUint8Array){
      return this.chRam[a];
    }
    const which=a<0x1000?0:1;
    return this.vromUint8Array[this.chrBank(which)*0x1000+(a&0x0fff)];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(!this.vromUint8Array){
      this.chRam[busAddress&0x1fff]=value;
    }
  }
}
