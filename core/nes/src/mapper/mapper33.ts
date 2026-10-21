import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * iNES Mapper 33 — Taito TC0190。
 * $8000/$8001 两段 8KB PRG，$8002–$A003 图案，$8000 bit6 选镜像。没有 IRQ。
 */
export class Mapper33 implements Mapper{
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private prg0=0;
  private prg1=0;
  private chr:number[]=[0,0,0,0,0,0];
  private prgCount:number;
  private chrCount:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.prgCount=Math.max(1,cartridge.romNum*2);
    this.prg0=0;
    this.prg1=0;
    this.chr=[0,2,4,5,6,7];
    if(!hasVrom){
      this.chRam=new Uint8Array(8192);
      this.vromUint8Array=null;
      this.chrCount=8;
    }else{
      this.chRam=null;
      this.vromUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.vromOffset);
      this.chrCount=Math.max(1,cartridge.vromNum*8);
    }
  }

  public cpuReadRpg(busAddress:number):number{
    let bank:number;
    if(busAddress<0xa000) bank=this.prg0;
    else if(busAddress<0xc000) bank=this.prg1;
    else if(busAddress<0xe000) bank=this.prgCount-2;
    else bank=this.prgCount-1;
    if(bank<0) bank=0;
    return this.rpgUint8Array[(bank%this.prgCount)*0x2000+(busAddress&0x1fff)];
  }

  public cpuWriteRpg(busAddress:number,value:number):void{
    switch(busAddress&0xa003){
    case 0x8000:
      this.prg0=value&0x3f;
      this.nametableMirror=(value&0x40)?NametableType.HORIZONTAL:NametableType.VIRTICAL;
      break;
    case 0x8001:
      this.prg1=value&0x3f;
      break;
    case 0x8002:
      this.chr[0]=(value&0x3f)<<1;
      break;
    case 0x8003:
      this.chr[1]=(value&0x3f)<<1;
      break;
    case 0xa000:
      this.chr[2]=value;
      break;
    case 0xa001:
      this.chr[3]=value;
      break;
    case 0xa002:
      this.chr[4]=value;
      break;
    case 0xa003:
      this.chr[5]=value;
      break;
    default:
      break;
    }
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
  }

  private chr1k(busAddress:number):number{
    const a=busAddress&0x1fff;
    if(a<0x800) return (this.chr[0]+((a>>10)&1))%this.chrCount;
    if(a<0x1000) return (this.chr[1]+((a>>10)&1))%this.chrCount;
    if(a<0x1400) return this.chr[2]%this.chrCount;
    if(a<0x1800) return this.chr[3]%this.chrCount;
    if(a<0x1c00) return this.chr[4]%this.chrCount;
    return this.chr[5]%this.chrCount;
  }

  public ppuReadPt(busAddress:number):number{
    const a=busAddress&0x1fff;
    if(!this.vromUint8Array){
      return this.chRam[(this.chr1k(a)*0x400+(a&0x3ff))&0x1fff];
    }
    return this.vromUint8Array[this.chr1k(a)*0x400+(a&0x3ff)];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(!this.vromUint8Array){
      const a=busAddress&0x1fff;
      this.chRam[(this.chr1k(a)*0x400+(a&0x3ff))&0x1fff]=value;
    }
  }
}
