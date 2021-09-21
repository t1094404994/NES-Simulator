import {Mapper,CartridgeReader} from './cartridge';
export class Mapper0 implements Mapper{
  //TODO如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 卡带上为什么会没有图案表？
  private chRamPtr:ArrayBuffer;
  private chRamPtrDataView:DataView;
  //RPG数据视图
  private rpgDataView:DataView;
  //vRom数据视图
  private vromDataView:DataView;
  //卡带
  private cartridge:CartridgeReader;
  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    //如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 
    this.reset(cartridge,hasVrom);
  }

  //初始化信息
  public reset(_cartridge:CartridgeReader,hasVrom:boolean):void{
    if(!hasVrom){
      this.chRamPtr=new ArrayBuffer(8192);
      this.chRamPtrDataView=new DataView(this.chRamPtr);
    }else{
      this.chRamPtr=null;
      this.chRamPtrDataView=null;
    }
    this.cartridge=_cartridge;
    //根据卡带数据 设置RPG和VROM数据视图
    this.rpgDataView=new DataView(this.cartridge.cartridgeData,this.cartridge.programOffset,this.cartridge.romNum*16384);
    this.vromDataView=new DataView(this.cartridge.cartridgeData,this.cartridge.vramOffset);
  }

  public clear():void{
    this.chRamPtrDataView=null;
    this.rpgDataView=null;
    this.vromDataView=null;
    this.chRamPtr=null;
    this.cartridge=null;
  }
  //CPU读取程序数据
  public cpuReadRpg(busAddress:number):number{
    //因为卡带数据在总线中从0x8000 二进制即10000000 0000000  所以只需把最高位截掉，即可得到相对于卡带的位置 
    //TODO注意，文件头不占据总线中的位置 不确定
    let address:number=busAddress&0x7fff;
    const maxAddress:number=this.rpgDataView.byteLength-1;
    if(address>maxAddress){
      console.warn('cpuReadRpg'+'总线地址:'+busAddress+'超过RPG ROM的最大值'+maxAddress);
      address=maxAddress;
    }
    return this.rpgDataView.getUint8(address);
  }
  //CPU写入程序数据
  public cpuWriteRpg(busAddress:number,value:number):void{
    console.warn(busAddress+':'+value+'MAPPER0(没有MAPPER)不支持cpuWriteRpg');
  }
  //CPU读取的扩展ROM
  public cpuReadAddRom(busAddress:number):number{
    console.warn(busAddress+'MAPPER0(没有MAPPER)不支持cpuWriteAddRom');
    return 0;
  }
  //CPU写入扩展ROM
  public cpuWriteAddRom(busAddress:number,value:number):void{
    console.warn(busAddress+':'+value+'MAPPER0(没有MAPPER)不支持cpuWriteAddRom');
  }

  //PPU读取图案表 ppu总线地址
  public ppuReadPt(busAddress:number):number{
    if(this.cartridge.romNum===0){
      return this.chRamPtrDataView.getUint8(busAddress);
    }else{
      return this.vromDataView.getUint8(busAddress);
    }
  }

  //PPU写入图案表
  public ppuWritePt(busAddress:number,value:number):void{
    if(this.cartridge.romNum===0){
      this.chRamPtrDataView.setUint8(busAddress,value);
    }else{
      console.warn(busAddress+':'+value+'MAPPER0(没有MAPPER)不支持ppuWritePt');
    }
  }
}