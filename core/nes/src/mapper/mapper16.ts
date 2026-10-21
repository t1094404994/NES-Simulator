import type {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../nametableType';

/**
 * 24C02：SDA 在写入值的 bit6，SCL 在 bit5。读回时数据在 bit4。
 * 设备地址 0xA0。随机写：[0xA0][地址][数据]。
 */
class Eeprom24C02{
  readonly bytes=new Uint8Array(256);
  private scl=1;
  private sda=1;
  private out=1;
  private phase:'idle'|'recv'|'ack'='idle';
  private bitCount=0;
  private shift=0;
  private addr=0;
  private step:'dev'|'word'|'data'='dev';

  writePins(scl:number,sda:number):boolean{
    let dirty=false;
    if(this.scl===1&&scl===1&&this.sda!==sda){
      if(sda===0){
        this.phase='recv';
        this.bitCount=0;
        this.shift=0;
        this.step='dev';
        this.out=1;
      }else{
        this.phase='idle';
        this.out=1;
      }
    }else if(this.scl===0&&scl===1&&this.phase==='recv'){
      this.shift=((this.shift<<1)|sda)&0xff;
      this.bitCount+=1;
      if(this.bitCount===8){
        const ack=this.take(this.shift);
        this.bitCount=0;
        this.shift=0;
        if(ack){
          this.phase='ack';
          this.out=0;
          dirty=ack==='dirty';
        }else{
          this.phase='idle';
          this.out=1;
        }
      }
    }else if(this.scl===0&&scl===1&&this.phase==='ack'){
      this.phase='recv';
      this.out=1;
    }
    this.scl=scl;
    this.sda=sda;
    return dirty;
  }

  /** 'ok' 继续，'dirty' 写入了一个字节，false 不应答。 */
  private take(byte:number):'ok'|'dirty'|false{
    if(this.step==='dev'){
      if((byte&0xfe)!==0xa0||(byte&1)!==0){
        return false;
      }
      this.step='word';
      return 'ok';
    }
    if(this.step==='word'){
      this.addr=byte&0xff;
      this.step='data';
      return 'ok';
    }
    const changed=this.bytes[this.addr]!==byte;
    this.bytes[this.addr]=byte;
    this.addr=(this.addr+1)&0xff;
    return changed?'dirty':'ok';
  }

  readLine():number{
    return this.out?0x10:0;
  }
}

/**
 * iNES Mapper 16 — Bandai FCG。
 * $8000 为 16KB PRG，末 16KB 固定；8 个 1KB CHR；CPU 周期 IRQ。
 * 存档是 256 字节 EEPROM，不是 $6000 WRAM。
 */
export class Mapper16 implements Mapper{
  public handles6000=true;
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private prg=0;
  private chr:number[]=[0,0,0,0,0,0,0,0];
  private prgCount:number;
  private chrCount:number;
  private irqEnabled=false;
  private irqCounter=0;
  private eeprom=new Eeprom24C02();
  private tryIrq:(()=>void)|null=null;
  private clearIrq:(()=>void)|null=null;
  private cartridge:CartridgeReader;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.cartridge=cartridge;
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.prgCount=Math.max(1,cartridge.romNum);
    this.prg=0;
    this.chr=[0,0,0,0,0,0,0,0];
    this.irqEnabled=false;
    this.irqCounter=0;
    this.eeprom=new Eeprom24C02();
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

  public exportBattery():Uint8Array{
    return this.eeprom.bytes.slice();
  }

  public importBattery(data:Uint8Array):void{
    if(data.length!==this.eeprom.bytes.length){
      return;
    }
    this.eeprom.bytes.set(data);
  }

  private writeReg(reg:number,value:number):void{
    if(reg<=7){
      this.chr[reg]=value;
      return;
    }
    if(reg===8){
      this.prg=value;
      return;
    }
    if(reg===9){
      const mode=value&0x03;
      if(mode===0) this.nametableMirror=NametableType.VIRTICAL;
      else if(mode===1) this.nametableMirror=NametableType.HORIZONTAL;
      else if(mode===2) this.nametableMirror=NametableType.ONESCREEN_LOWER;
      else this.nametableMirror=NametableType.ONESCREEN_HIGHER;
      return;
    }
    if(reg===0x0a){
      this.irqEnabled=(value&1)!==0;
      this.clearIrq?.();
      return;
    }
    if(reg===0x0b){
      this.irqCounter=(this.irqCounter&0xff00)|value;
      return;
    }
    if(reg===0x0c){
      this.irqCounter=(this.irqCounter&0x00ff)|((value&0xff)<<8);
      return;
    }
    if(reg===0x0d){
      const scl=(value>>5)&1;
      const sda=(value>>6)&1;
      if(this.eeprom.writePins(scl,sda)){
        this.cartridge.onBatteryDirty?.();
      }
    }
  }

  public cpuReadRpg(busAddress:number):number{
    const bank=busAddress<0xc000?this.prg%this.prgCount:this.prgCount-1;
    return this.rpgUint8Array[bank*0x4000+(busAddress&0x3fff)];
  }

  public cpuWriteRpg(busAddress:number,value:number):void{
    this.writeReg(busAddress&0x0f,value&0xff);
  }

  public cpuReadAddRom(busAddress:number):number{
    if((busAddress&0x0f)===0x0d){
      return this.eeprom.readLine();
    }
    return 0;
  }

  public cpuWriteAddRom(busAddress:number,value:number):void{
    this.writeReg(busAddress&0x0f,value&0xff);
  }

  public clockCpu():void{
    if(!this.irqEnabled){
      return;
    }
    if(this.irqCounter===0){
      this.tryIrq?.();
      this.irqEnabled=false;
      return;
    }
    this.irqCounter=(this.irqCounter-1)&0xffff;
    if(this.irqCounter===0){
      this.tryIrq?.();
      this.irqEnabled=false;
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
