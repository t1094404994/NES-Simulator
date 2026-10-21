import type {Mapper,CartridgeReader} from '../cartridge';

/**
 * iNES Mapper 34。
 * 没有 CHR ROM：BNROM，写 $8000+ 切 32KB PRG。
 * 有 CHR ROM：NINA-001，$7FFD 切 32KB PRG，$7FFE/$7FFF 切两段 4KB CHR。
 */
export class Mapper34 implements Mapper{
  public handles6000:boolean;
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private chRam:Uint8Array;
  public nametableMirror:number;
  private nina:boolean;
  private prgBank=0;
  private chrLo=0;
  private chrHi=0;
  private prgCount:number;
  private chrCount:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(cartridge:CartridgeReader,hasVrom:boolean):void{
    this.nina=hasVrom;
    this.handles6000=hasVrom;
    this.rpgUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.programOffset,cartridge.romNum*16384);
    this.prgCount=Math.max(1,cartridge.romNum>>1);
    this.prgBank=0;
    this.chrLo=0;
    this.chrHi=0;
    if(!hasVrom){
      this.chRam=new Uint8Array(8192);
      this.vromUint8Array=null;
      this.chrCount=1;
    }else{
      this.chRam=null;
      this.vromUint8Array=new Uint8Array(cartridge.cartridgeData,cartridge.vromOffset);
      this.chrCount=Math.max(1,cartridge.vromNum*2);
    }
  }

  public cpuReadRpg(busAddress:number):number{
    const bank=this.prgBank%this.prgCount;
    return this.rpgUint8Array[bank*0x8000+(busAddress&0x7fff)];
  }

  public cpuWriteRpg(_busAddress:number,value:number):void{
    if(!this.nina){
      this.prgBank=value;
    }
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(busAddress:number,value:number):void{
    if(!this.nina){
      return;
    }
    if(busAddress===0x7ffd) this.prgBank=value;
    else if(busAddress===0x7ffe) this.chrLo=value;
    else if(busAddress===0x7fff) this.chrHi=value;
  }

  public ppuReadPt(busAddress:number):number{
    const a=busAddress&0x1fff;
    if(!this.vromUint8Array){
      return this.chRam[a];
    }
    const bank=(a<0x1000?this.chrLo:this.chrHi)%this.chrCount;
    return this.vromUint8Array[bank*0x1000+(a&0x0fff)];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(!this.vromUint8Array){
      this.chRam[busAddress&0x1fff]=value;
    }
  }
}
