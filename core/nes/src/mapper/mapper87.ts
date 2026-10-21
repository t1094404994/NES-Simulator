import type {Mapper,CartridgeReader} from '../cartridge';

/** iNES Mapper 87：PRG 固定 32KB。写 $6000 时 bit0/bit1 对调后作为 8KB CHR bank */
export class Mapper87 implements Mapper{
  public handles6000=true;
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private chrBank=0;
  private chrCount:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.chrBank=0;
    if(!hasVrom){
      this.chRam=new Uint8Array(8192);
      this.vromUint8Array=null;
      this.chrCount=1;
    }else{
      this.chRam=null;
      this.vromUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.vromOffset);
      this.chrCount=Math.max(1,cartridge.vromNum);
    }
  }

  public cpuReadRpg(busAddress:number):number{
    const size=this.rpgUint8Array.length;
    let addr=busAddress&0x7fff;
    if(size<0x8000){
      addr&=size-1;
    }
    return this.rpgUint8Array[addr];
  }

  public cpuWriteRpg(_busAddress:number,_value:number):void{
    //
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,value:number):void{
    this.chrBank=((value&1)<<1)|((value>>1)&1);
  }

  public ppuReadPt(busAddress:number):number{
    if(!this.vromUint8Array){
      return this.chRam[busAddress&0x1fff];
    }
    const bank=this.chrBank%this.chrCount;
    return this.vromUint8Array[bank*0x2000+(busAddress&0x1fff)];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(!this.vromUint8Array){
      this.chRam[busAddress&0x1fff]=value;
    }
  }
}
