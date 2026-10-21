import type {CartridgeReader} from '../cartridge';
import {Vrc24} from './vrc24';

/** iNES Mapper 25 — VRC4b/d、VRC2c。地址线相对 mapper 23 对调。 */
export class Mapper25 extends Vrc24{
  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    super(cartridge,hasVrom,0,1);
  }
}
