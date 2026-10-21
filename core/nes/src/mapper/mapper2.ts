import type {Mapper,CartridgeReader} from '../cartridge';
export class Mapper2 implements Mapper{
  //TODO如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 卡带上为什么会没有图案表？
  private chRamPtr:ArrayBuffer;
  private chRamPtrUint8Array:Uint8Array;
  //RPG数据视图
  private rpgUint8Array:Uint8Array;
  //vRom数据视图
  private vromUint8Array:Uint8Array;
  //卡带
  private cartridge:CartridgeReader;
  public nametableMirror:number;

  //
  public prgSelect16kbLo:number;
  public prgSelect16kbHi:number
  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    //如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 
    this.reset(cartridge,hasVrom);
  }

  //初始化信息
  public reset(_cartridge:CartridgeReader,hasVrom:boolean):void{
    if(!hasVrom){
      this.chRamPtr=new ArrayBuffer(8192);
      this.chRamPtrUint8Array=new Uint8Array(this.chRamPtr);
    }else{
      this.chRamPtr=null;
      this.chRamPtrUint8Array=null;
    }
    this.cartridge=_cartridge;
    this.prgSelect16kbLo=0;
    this.prgSelect16kbHi=this.cartridge.romNum-1;
    //根据卡带数据 设置RPG和VROM数据视图
    this.rpgUint8Array=new Uint8Array(this.cartridge.cartridgeData,this.cartridge.programOffset,this.cartridge.romNum*16384);
    this.vromUint8Array=new Uint8Array(this.cartridge.cartridgeData,this.cartridge.vromOffset);
  }

  public clear():void{
    this.chRamPtrUint8Array=null;
    this.rpgUint8Array=null;
    this.vromUint8Array=null;
    this.chRamPtr=null;
    this.cartridge=null;
  }
  //CPU读取程序数据
  public cpuReadRpg(busAddress:number):number{
    //TODO注意，文件头不占据总线中的位置 不确定
    //CPU读取两个16KB的代码段
    if (busAddress <= 0xbfff){
      const programAddr:number = 0x4000 * this.prgSelect16kbLo + (busAddress & 0x3fff);
      return this.rpgUint8Array[programAddr];
    }else{
      const programAddr:number = 0x4000 * this.prgSelect16kbHi + (busAddress & 0x3fff);
      return this.rpgUint8Array[programAddr];
    }
  }
  //CPU写入程序数据
  public cpuWriteRpg(_busAddress:number,value:number):void{
    // bank 掩码按 16KB PRG 块数（romNum）
    const mask=Math.max(1,this.cartridge.romNum)-1;
    this.prgSelect16kbLo = value & mask;
  }
  //CPU读取的扩展ROM
  public cpuReadAddRom(busAddress:number):number{
    console.warn(busAddress+'MAPPER2不支持cpuWriteAddRom');
    return 0;
  }
  //CPU写入扩展ROM
  public cpuWriteAddRom(busAddress:number,value:number):void{
    console.warn(busAddress+':'+value+'MAPPER2不支持cpuWriteAddRom');
  }

  //PPU读取图案表 ppu总线地址
  public ppuReadPt(busAddress:number):number{
    if(this.cartridge.vromNum===0){
      return this.chRamPtrUint8Array[busAddress];
    }else{
      return this.vromUint8Array[busAddress];
    }
  }

  //PPU写入图案表
  public ppuWritePt(busAddress:number,value:number):void{
    if(this.cartridge.vromNum===0){
      this.chRamPtrUint8Array[busAddress]=value;
    }else{
      console.warn(busAddress+':'+value+'卡带ROM不能写入');
    }
  }
}