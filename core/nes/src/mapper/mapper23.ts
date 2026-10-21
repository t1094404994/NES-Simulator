import type {CartridgeReader} from '../cartridge';
import {Vrc24} from './vrc24';

/** iNES Mapper 23 — VRC2b / VRC4e。寄存器 A0 取 CPU A1，A1 取 CPU A0。 */
export class Mapper23 extends Vrc24{
  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    super(cartridge,hasVrom,1,0);
  }
}
