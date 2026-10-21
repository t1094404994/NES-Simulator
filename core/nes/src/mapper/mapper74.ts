import type {CartridgeReader} from '../cartridge';
import {Mapper4} from './mapper4';

/**
 * iNES Mapper 74 — Waixing MMC3。
 * 2KB 图案寄存器选中 bank 8 或 9 时，这 2KB 来自额外 CHR RAM。
 */
export class Mapper74 extends Mapper4{
  // 字段初始化在 super() 之后，构造期 reset 里的赋值会被盖掉，所以用到时再分配。
  private extraChr:Uint8Array|null=null;

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    super.reset(cartridge,hasVrom);
    this.extraChr=new Uint8Array(2048);
  }

  private chrRam():Uint8Array{
    if(!this.extraChr){
      this.extraChr=new Uint8Array(2048);
    }
    return this.extraChr;
  }

  private waixingOffset(busAddress:number):number{
    const a=busAddress&0x1fff;
    let reg:number;
    let inner:number;
    if(this.chrMode===0){
      if(a<0x800){
        reg=this.bankRegs[0];
        inner=a;
      }else if(a<0x1000){
        reg=this.bankRegs[1];
        inner=a-0x800;
      }else{
        return -1;
      }
    }else if(a>=0x1000&&a<0x1800){
      reg=this.bankRegs[0];
      inner=a-0x1000;
    }else if(a>=0x1800){
      reg=this.bankRegs[1];
      inner=a-0x1800;
    }else{
      return -1;
    }
    if((reg&0xfe)!==8){
      return -1;
    }
    return inner&0x7ff;
  }

  public ppuReadPt(busAddress:number):number{
    const hit=this.waixingOffset(busAddress);
    if(hit>=0){
      return this.chrRam()[hit];
    }
    return super.ppuReadPt(busAddress);
  }

  public ppuWritePt(busAddress:number,value:number):void{
    const hit=this.waixingOffset(busAddress);
    if(hit>=0){
      this.chrRam()[hit]=value;
      return;
    }
    super.ppuWritePt(busAddress,value);
  }
}
