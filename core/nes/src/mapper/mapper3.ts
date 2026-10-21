import type {Mapper,CartridgeReader} from '../cartridge';

/** iNES Mapper 3 — CNROM：固定 PRG，写 $8000+ 选择 8KB CHR bank */
export class Mapper3 implements Mapper{
  private chRamPtr:ArrayBuffer;
  private chRamPtrUint8Array:Uint8Array;
  private rpgUint8Array:Uint8Array;
  private vromUint8Array:Uint8Array;
  private cartridge:CartridgeReader;
  public nametableMirror:number;
  private chrBank:number;
  private chrBankMask:number;

  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    this.reset(cartridge,hasVrom);
  }

  public reset(_cartridge:CartridgeReader,hasVrom:boolean):void{
    if(!hasVrom){
      this.chRamPtr=new ArrayBuffer(8192);
      this.chRamPtrUint8Array=new Uint8Array(this.chRamPtr);
    }else{
      this.chRamPtr=null;
      this.chRamPtrUint8Array=null;
    }
    this.cartridge=_cartridge;
    this.rpgUint8Array=new Uint8Array(
      this.cartridge.cartridgeData,
      this.cartridge.programOffset,
      this.cartridge.romNum*16384
    );
    this.vromUint8Array=new Uint8Array(this.cartridge.cartridgeData,this.cartridge.vromOffset);
    this.chrBank=0;
    // vromNum 为 8KB 块数
    const n=Math.max(1,this.cartridge.vromNum);
    this.chrBankMask=n-1;
  }

  public cpuReadRpg(busAddress:number):number{
    let address:number;
    if(this.cartridge.romNum===1){
      address=busAddress&0x3fff;
    }else{
      address=busAddress&0x7fff;
    }
    return this.rpgUint8Array[address];
  }

  public cpuWriteRpg(_busAddress:number,value:number):void{
    this.chrBank=value&this.chrBankMask;
  }

  public cpuReadAddRom(_busAddress:number):number{
    return 0;
  }

  public cpuWriteAddRom(_busAddress:number,_value:number):void{
    //
  }

  public ppuReadPt(busAddress:number):number{
    if(this.cartridge.vromNum===0){
      return this.chRamPtrUint8Array[busAddress&0x1fff];
    }
    const addr=this.chrBank*0x2000+(busAddress&0x1fff);
    return this.vromUint8Array[addr];
  }

  public ppuWritePt(busAddress:number,value:number):void{
    if(this.cartridge.vromNum===0){
      this.chRamPtrUint8Array[busAddress&0x1fff]=value;
    }
  }
}
