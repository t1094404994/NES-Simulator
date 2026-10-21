import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * Sunsoft FME-7（iNES 69）。
 * $8000 选寄存器，$A000 写参数。不做 5B 音源。
 */
export class Mapper69 implements Mapper{
  public handles6000=true;
  public addRam:ArrayBuffer;
  public addRamDataView:Uint8Array;
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private command=0;
  private chr:number[]=[0,0,0,0,0,0,0,0];
  private prg6000=0;
  private prg8=0;
  private prgA=0;
  private prgC=0;
  private ramSelect=false;
  private ramProtect=false;
  private prgCount:number;
  private chrCount:number;
  private irqEnable=false;
  private irqCount=false;
  private irqCounter=0;
  private tryIrq:(()=>void)|null=null;
  private clearIrq:(()=>void)|null=null;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.addRam=new ArrayBuffer(0x2000);
    this.addRamDataView=new Uint8Array(this.addRam);
    this.prgCount=Math.max(1,cartridge.romNum*2);
    this.command=0;
    this.chr=[0,0,0,0,0,0,0,0];
    this.prg6000=0;
    this.prg8=0;
    this.prgA=1;
    this.prgC=2;
    this.ramSelect=false;
    this.ramProtect=false;
    this.irqEnable=false;
    this.irqCount=false;
    this.irqCounter=0;
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

  public bindIrq(tryIrq:()=>void,clearIrq?:()=>void):void{
    this.tryIrq=tryIrq;
    this.clearIrq=clearIrq||null;
  }

  public cpuReadRpg(busAddress:number):number{
    let bank:number;
    if(busAddress<0xa000) bank=this.prg8;
    else if(busAddress<0xc000) bank=this.prgA;
    else if(busAddress<0xe000) bank=this.prgC;
    else bank=this.prgCount-1;
    return this.rpgUint8Array[(bank%this.prgCount)*0x2000+(busAddress&0x1fff)];
  }

  public cpuWriteRpg(busAddress:number,value:number):void{
    if(busAddress<0xa000){
      this.command=value&0x0f;
      return;
    }
    if(busAddress>=0xc000){
      return;
    }
    const cmd=this.command;
    if(cmd<=7){
      this.chr[cmd]=value;
      return;
    }
    if(cmd===8){
      this.ramSelect=(value&0x40)!==0;
      this.ramProtect=(value&0x80)!==0;
      this.prg6000=value&0x3f;
      return;
    }
    if(cmd===9){
      this.prg8=value&0x3f;
      return;
    }
    if(cmd===0x0a){
      this.prgA=value&0x3f;
      return;
    }
    if(cmd===0x0b){
      this.prgC=value&0x3f;
      return;
    }
    if(cmd===0x0c){
      const mode=value&0x03;
      if(mode===0) this.nametableMirror=NametableType.VIRTICAL;
      else if(mode===1) this.nametableMirror=NametableType.HORIZONTAL;
      else if(mode===2) this.nametableMirror=NametableType.ONESCREEN_LOWER;
      else this.nametableMirror=NametableType.ONESCREEN_HIGHER;
      return;
    }
    if(cmd===0x0d){
      this.irqCount=(value&0x80)!==0;
      this.irqEnable=(value&0x01)!==0;
      this.clearIrq?.();
      return;
    }
    if(cmd===0x0e){
      this.irqCounter=(this.irqCounter&0xff00)|value;
      this.clearIrq?.();
      return;
    }
    if(cmd===0x0f){
      this.irqCounter=(this.irqCounter&0x00ff)|((value&0xff)<<8);
      this.clearIrq?.();
    }
  }

  public cpuReadAddRom(busAddress:number):number{
    if(this.ramSelect){
      return this.addRamDataView[busAddress-0x6000];
    }
    return this.rpgUint8Array[(this.prg6000%this.prgCount)*0x2000+(busAddress&0x1fff)];
  }

  public cpuWriteAddRom(busAddress:number,value:number):void{
    if(this.ramSelect&&!this.ramProtect){
      this.addRamDataView[busAddress-0x6000]=value;
    }
  }

  public clockCpu():void{
    if(!this.irqCount){
      return;
    }
    if(this.irqCounter===0){
      this.irqCounter=0xffff;
      if(this.irqEnable){
        this.tryIrq?.();
      }
      return;
    }
    this.irqCounter=(this.irqCounter-1)&0xffff;
  }

  public ppuReadPt(busAddress:number):number{
    const a=busAddress&0x1fff;
    const bank=this.chr[a>>10]%this.chrCount;
    if(!this.vromUint8Array){
      return this.chRam[(bank*0x400+(a&0x3ff))&0x1fff];
    }
    return this.vromUint8Array[bank*0x400+(a&0x3ff)];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(!this.vromUint8Array){
      const a=busAddress&0x1fff;
      const bank=this.chr[a>>10]%this.chrCount;
      this.chRam[(bank*0x400+(a&0x3ff))&0x1fff]=value;
    }
  }
}
