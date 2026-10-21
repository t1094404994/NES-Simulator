import type {Mapper,CartridgeReader} from '../cartridge';
export class Mapper0 implements Mapper{
  //TODO如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 卡带上为什么会没有图案表？
  private chRamPtr:ArrayBuffer;
  private chRamPtrUint8Array:Uint8Array;
  public addRam:ArrayBuffer;
  public addRamDataView:Uint8Array;
  //RPG数据视图
  private rpgUint8Array:Uint8Array;
  //vRom数据视图
  private vromUint8Array:Uint8Array;
  //卡带
  private cartridge:CartridgeReader;
  public nametableMirror:number;
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
    this.addRam=new ArrayBuffer(0x2000);
    this.addRamDataView=new Uint8Array(this.addRam);
    this.cartridge=_cartridge;
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
    //因为卡带数据在总线中从0x8000 二进制即10000000 0000000  所以只需把最高位截掉，即可得到相对于卡带的位置 
    //TODO注意，文件头不占据总线中的位置 不确定
    let address:number;
    if(this.cartridge.romNum===1){
      address=busAddress&0x3fff;
    }else{
      address=busAddress&0x7fff;
    }
    const maxAddress:number=this.rpgUint8Array.byteLength-1;
    if(address>maxAddress){
      console.warn('cpuReadRpg'+'总线地址:'+busAddress+'超过RPG ROM的最大值'+maxAddress);
      address=maxAddress;
    }
    return this.rpgUint8Array[address];
  }
  //CPU写入程序数据
  public cpuWriteRpg(busAddress:number,value:number):void{
    console.warn(busAddress+':'+value+'MAPPER0(没有MAPPER)不支持cpuWriteRpg');
  }
  //CPU读取的扩展ROM
  public cpuReadAddRom(busAddress:number):number{
    return this.addRamDataView[busAddress-0x6000];
  }
  //CPU写入扩展ROM
  public cpuWriteAddRom(busAddress:number,value:number):void{
    this.addRamDataView[busAddress-0x6000]=value;
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
      console.warn(busAddress+':'+value+'MAPPER0(没有MAPPER)不支持ppuWritePt');
    }
  }
}