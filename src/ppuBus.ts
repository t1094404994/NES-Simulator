//PPU总线

import { CartridgeReader } from './cartridge';

//名称表类型
export enum NametableType{
  HORIZONTAL,
  VIRTICAL,
  ONESCREEN_LOWER=9,
  ONESCREEN_HIGHER=10,
}

//精灵数据接口
export interface OAMSprite{
  //精灵的坐标
  locX:number;
  locY:number;
  //16bit 精灵的图案表起始位置 
  patterntableAddress:number;
  //精灵使用的调色板
  paletteDx:number;
  behindBackground:boolean;
  //x ,y 轴上是否翻转
  flipX:boolean;
  flipY:boolean;
}
export class Oamram{
  //精灵RAM数据 256字节  一共256/4=64个精灵信息
  private data:ArrayBuffer;
  private dataView:DataView;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.data=new ArrayBuffer(256);
    this.dataView=new DataView(this.data);
  }

  public setData(address:number,value:number):void{
    this.dataView.setUint8(address,value);
  }

  public getData(address:number):number{
    return this.dataView.getUint8(address);
  }

  //普通8x8的精灵
  public getOneSprite(id:number):OAMSprite{
    const sprite:OAMSprite={locX:0,locY:0,patterntableAddress:0,paletteDx:0,flipX:false,flipY:false,behindBackground:false};
    const offset:number=id*4;
    sprite.locY=this.dataView.getUint8(offset);
    sprite.patterntableAddress=this.dataView.getUint8(offset+1)*16;
    const bit3:number=this.dataView.getUint8(offset+2);
    sprite.paletteDx=bit3&0x3;
    sprite.behindBackground=(bit3&(1<<5))!==0;
    //x轴翻转：当O6等于0时翻转，等于1时不翻转
    if(bit3&(1<<6)) sprite.flipX=false;
    else sprite.flipX=true;
    //y轴翻转：当O7等于1时翻转，等于0时不翻转
    if(bit3&(1<<7)) sprite.flipY=true;
    else sprite.flipY=false;
    sprite.locX=this.dataView.getUint8(offset+3);
    return sprite;
  }
  //特殊的8x16的精灵
  public getOneSpriteLong(id:number):OAMSprite{
    const sprite:OAMSprite={locX:0,locY:0,patterntableAddress:0,paletteDx:0,flipX:false,flipY:false,behindBackground:false};
    const offset:number=id*4;
    sprite.locY=this.dataView.getUint8(offset);
    const bptableDx:number=this.dataView.getUint8(offset+1)& 1; //对于long sprite，最后一位的含义是使用哪个图案表
    const tileDx:number= this.dataView.getUint8(offset+1) >> 1;
    sprite.patterntableAddress=(bptableDx*0x100+tileDx*32)&0xffff;
    const bit3:number=this.dataView.getUint8(offset+2);
    sprite.paletteDx=bit3&0x3;
    sprite.behindBackground=(bit3&(1<<5))!==0;
    //x轴翻转：当O6等于0时翻转，等于1时不翻转
    if(bit3&(1<<6)) sprite.flipX=false;
    else sprite.flipX=true;
    //y轴翻转：当O7等于1时翻转，等于0时不翻转
    if(bit3&(1<<7)) sprite.flipY=true;
    else sprite.flipY=false;
    sprite.locX=this.dataView.getUint8(offset+3);
    return sprite;
  }
}

interface NameTableInfor{
  address:number;
  nameTable:number;
}

//PPU总线
export class PpuBus{
  //1kb 32x32名称表1
  private nameTable1:ArrayBuffer;
  
  private nameTable1DateView:DataView;
  //1kb 32x32名称表2
  private nameTable2:ArrayBuffer;
  
  private nameTable2DateView:DataView;
  //32字节调色板
  private palette:ArrayBuffer;
  
  private paletteDataView:DataView;

  //卡带
  private cartridgeReader:CartridgeReader;
  constructor(){
    this.reset();
  }

  //重置所有数据
  public reset():void{
    this.nameTable1=new ArrayBuffer(1024);
    this.nameTable2=new ArrayBuffer(1024);
    this.nameTable1DateView=new DataView(this.nameTable1);
    this.nameTable2DateView=new DataView(this.nameTable2);
    this.palette=new ArrayBuffer(32);
    this.paletteDataView=new DataView(this.palette);
  }

  //设置卡带
  public setCartridgeReader(_cartridgeReader:CartridgeReader):void{
    this.cartridgeReader=_cartridgeReader;
  }
  //从PPU总线获取数据
  public getValue(busAddress:number):number{
    //获取图案表数据
    if(busAddress>=0&&busAddress<0x2000){
      return this.cartridgeReader.mapper.ppuReadPt(busAddress);
    }
    //获取名称表数据
    else if(busAddress>=0x2000&&busAddress<0x3f00){
      const infor:NameTableInfor=this.getNametableAdd(busAddress);
      let table:DataView;
      if(infor.nameTable===1) table=this.nameTable1DateView;
      else table=this.nameTable2DateView;
      return table.getUint8(infor.address);
    }
    else if(busAddress>=0x3f00&&busAddress<0x4000){
      return this.paletteDataView.getUint8(busAddress&0x1f);
    }
    else{
      console.warn('getValue时PPU总线地址溢出');
      return 0;
    }
  }

  //从PPU总线设置数据
  public setValue(busAddress:number,value:number):void{
    //尝试写入数据到卡带
    if(busAddress<=0x1fff){
      this.cartridgeReader.mapper.ppuWritePt(busAddress,value);
    }
    //写入数据到名称表
    else if(busAddress>=0x2000&&busAddress<0x3f00){
      const infor:NameTableInfor=this.getNametableAdd(busAddress);
      let table:DataView;
      if(infor.nameTable===1) table=this.nameTable1DateView;
      else table=this.nameTable2DateView;
      table.setUint8(infor.address,value);
    }
    //写入数据到调色板
    else if(busAddress>=0x3f00&&busAddress<0x4000){
      let address:number= busAddress & 0x1f;
      if (address === 0x10)
        address = 0x0;
      else if (address === 0x14)
        address = 0x4;
      else if (address === 0x18)
        address = 0x8;
      else if (address === 0x1c)
        address = 0xc;
      this.paletteDataView.setUint8(address,value);
    }
    else{
      console.warn('setValue时PPU总线地址溢出');
    }
  }

  //根据总线地址,名称表的镜像方式，获取地址和名称表1或2
  public getNametableAdd(busAddress:number):NameTableInfor{
    const tableInfor:NameTableInfor={address:0,nameTable:1};
    switch(this.cartridgeReader.mapper.nametableMirror){
    //水平镜像 排布为名称表1|名称表1 |(0x800)名称表2|名称表2
    case NametableType.HORIZONTAL:
      if(busAddress&0x800) tableInfor.nameTable=2;
      else tableInfor.nameTable=1;
      break;
    //垂直镜像 
    case NametableType.VIRTICAL:
      if(busAddress&0x400) tableInfor.nameTable=2;
      else tableInfor.nameTable=1;
      break;
    //只有名称表1
    case NametableType.ONESCREEN_LOWER:
      tableInfor.nameTable=1;
      break;
    //只有名称表2
    case NametableType.ONESCREEN_HIGHER:
      tableInfor.nameTable=2;
      break;  
    default:
      tableInfor.nameTable=1;
      console.warn('没有找到名称表的镜像方式');
    }
    tableInfor.address=busAddress&0x3ff;
    return tableInfor;
  }
}