import type {CartridgeReader,Mapper} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * VRC2/VRC4。a0Shift/a1Shift 是寄存器最低两位所取的 CPU 地址线。
 * Mapper 25 相对 23 对调这两根线。不含 mapper 22 的 CHR 右移。
 */
export class Vrc24 implements Mapper{
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private prg0=0;
  private prg1=0;
  private chr:number[]=[0,0,0,0,0,0,0,0];
  private prgCount:number;
  private chrCount:number;
  private irqLatch=0;
  private irqCounter=0;
  private irqEnable=false;
  private irqEnableAfter=false;
  private irqModeCycle=false;
  private prescaler=0;
  private tryIrq:(()=>void)|null=null;
  private clearIrq:(()=>void)|null=null;

  constructor(
    cartridge:CartridgeReader,
    hasVrom:boolean,
    private a0Shift:number,
    private a1Shift:number,
  ){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.prgCount=Math.max(1,cartridge.romNum*2);
    this.prg0=0;
    this.prg1=0;
    this.chr=[0,0,0,0,0,0,0,0];
    this.irqLatch=0;
    this.irqCounter=0;
    this.irqEnable=false;
    this.irqEnableAfter=false;
    this.irqModeCycle=false;
    this.prescaler=0;
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

  private reg(addr:number):number{
    const a0=(addr>>this.a0Shift)&1;
    const a1=(addr>>this.a1Shift)&1;
    return (addr&0xf000)|a0|(a1<<1);
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
    const reg=this.reg(busAddress);
    const hi=(reg&0xf000);
    const lo=reg&0x0003;
    if(hi===0x8000){
      this.prg0=value&0x1f;
      return;
    }
    if(hi===0xa000){
      this.prg1=value&0x1f;
      return;
    }
    if(hi===0x9000){
      const mode=value&0x03;
      if(mode===0) this.nametableMirror=NametableType.VIRTICAL;
      else if(mode===1) this.nametableMirror=NametableType.HORIZONTAL;
      else if(mode===2) this.nametableMirror=NametableType.ONESCREEN_LOWER;
      else this.nametableMirror=NametableType.ONESCREEN_HIGHER;
      return;
    }
    if(hi>=0xb000&&hi<=0xe000){
      const index=((hi-0xb000)>>11)+(lo>>1);
      if(index<0||index>7){
        return;
      }
      if((lo&1)===0){
        this.chr[index]=(this.chr[index]&0xf0)|(value&0x0f);
      }else{
        this.chr[index]=(this.chr[index]&0x0f)|((value&0x0f)<<4);
      }
      return;
    }
    if(hi!==0xf000){
      return;
    }
    if(lo===0){
      this.irqLatch=(this.irqLatch&0xf0)|(value&0x0f);
    }else if(lo===1){
      this.irqLatch=(this.irqLatch&0x0f)|((value&0x0f)<<4);
    }else if(lo===2){
      this.irqModeCycle=(value&0x04)!==0;
      this.irqEnable=(value&0x02)!==0;
      this.irqEnableAfter=(value&0x01)!==0;
      if(this.irqEnable){
        this.irqCounter=this.irqLatch;
        this.prescaler=0;
      }
      this.clearIrq?.();
    }else{
      this.clearIrq?.();
      this.irqEnable=this.irqEnableAfter;
    }
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
  }

  public clockCpu():void{
    if(!this.irqEnable){
      return;
    }
    const tick=():void=>{
      if(this.irqCounter===0xff){
        this.irqCounter=this.irqLatch;
        this.tryIrq?.();
      }else{
        this.irqCounter=(this.irqCounter+1)&0xff;
      }
    };
    if(this.irqModeCycle){
      tick();
      return;
    }
    this.prescaler+=1;
    if(this.prescaler>=114){
      this.prescaler=0;
      tick();
    }
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
