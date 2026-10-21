import type {Mapper,CartridgeReader} from '../cartridge';

/** iNES Mapper 66 — GxROM：bit4–5 为 32KB PRG，bit0–1 为 8KB CHR */
export class Mapper66 implements Mapper{
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private prgBank=0;
  private chrBank=0;
  private prgCount:number;
  private chrCount:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.prgCount=Math.max(1,cartridge.romNum>>1);
    this.prgBank=0;
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
    const bank=this.prgBank%this.prgCount;
    return this.rpgUint8Array[bank*0x8000+(busAddress&0x7fff)];
  }

  public cpuWriteRpg(_busAddress:number,value:number):void{
    this.prgBank=(value>>4)&0x03;
    this.chrBank=value&0x03;
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
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
