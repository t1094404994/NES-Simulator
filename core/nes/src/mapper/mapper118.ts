import type {CartridgeReader} from '../cartridge';
import {Mapper4} from './mapper4';

/**
 * iNES Mapper 118 — TxSROM。
 * 忽略 $A000 镜像位。1KB 图案 bank 的 bit7 选择对应名称表页。
 */
export class Mapper118 extends Mapper4{
  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    super(cartridge,hasVrom);
    this.chrNametable=true;
  }

  public nametableIndex(ppuAddress:number):number{
    const slot=(ppuAddress>>10)&3;
    const reg=this.chrMode===0?(slot<2?0:1):(2+slot);
    return (this.bankRegs[reg]&0x80)?1:0;
  }
}
