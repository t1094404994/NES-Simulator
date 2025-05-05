import {Mapper,CartridgeReader} from '../cartridge';
export class Mapper4 implements Mapper{
  //TODO如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 卡带上为什么会没有图案表？
  private chRamPtr:ArrayBuffer;
  private chRamPtrDataView:DataView;
  //RPG数据视图
  private rpgDataView:DataView;
  //vRom数据视图
  private vromDataView:DataView;
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
      this.chRamPtrDataView=new DataView(this.chRamPtr);
    }else{
      this.chRamPtr=null;
      this.chRamPtrDataView=null;
    }
    this.cartridge=_cartridge;
    //根据卡带数据 设置RPG和VROM数据视图
    this.rpgDataView=new DataView(this.cartridge.cartridgeData,this.cartridge.programOffset,this.cartridge.romNum*16384);
    this.vromDataView=new DataView(this.cartridge.cartridgeData,this.cartridge.vromOffset);
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
    return 0;
  }
  //CPU写入程序数据
  public cpuWriteRpg(busAddress:number,value:number):void{
    //
  }
  //CPU读取的扩展ROM
  public cpuReadAddRom(busAddress:number):number{
    return 0;
  }
  //CPU写入扩展ROM
  public cpuWriteAddRom(busAddress:number,value:number):void{
    //
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
      console.warn(busAddress+':'+value+'卡带ROM不能写入');
    }
  }
}