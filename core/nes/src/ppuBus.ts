//PPU总线

import { CartridgeReader } from './cartridge';
import { NametableType } from './nametableType';

export { NametableType };

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
    // Nesdev: OAM byte2 bit6 = horizontal flip when set
    sprite.flipX=(bit3&(1<<6))!==0;
    // Nesdev: OAM byte2 bit7 = vertical flip when set
    sprite.flipY=(bit3&(1<<7))!==0;
    sprite.locX=this.dataView.getUint8(offset+3);
    return sprite;
  }
  //特殊的8x16的精灵
  public getOneSpriteLong(id:number):OAMSprite{
    const sprite:OAMSprite={locX:0,locY:0,patterntableAddress:0,paletteDx:0,flipX:false,flipY:false,behindBackground:false};
    const offset:number=id*4;
    sprite.locY=this.dataView.getUint8(offset);
    // Nesdev 8x16: bit0 选图案表 $0000/$1000，bit7-1 为顶层 tile（偶数编号）
    const tileByte=this.dataView.getUint8(offset+1);
    const bank=(tileByte&1)*0x1000;
    const topTile=tileByte&0xfe;
    sprite.patterntableAddress=(bank+topTile*16)&0xffff;
    const bit3:number=this.dataView.getUint8(offset+2);
    sprite.paletteDx=bit3&0x3;
    sprite.behindBackground=(bit3&(1<<5))!==0;
    sprite.flipX=(bit3&(1<<6))!==0;
    sprite.flipY=(bit3&(1<<7))!==0;
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
  //1kb 32x32名称表（四屏时用到 1–4）
  private nameTable1:ArrayBuffer;
  private nameTable1DateView:DataView;
  private nameTable2:ArrayBuffer;
  private nameTable2DateView:DataView;
  private nameTable3:ArrayBuffer;
  private nameTable3DateView:DataView;
  private nameTable4:ArrayBuffer;
  private nameTable4DateView:DataView;
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
    this.nameTable3=new ArrayBuffer(1024);
    this.nameTable4=new ArrayBuffer(1024);
    this.nameTable1DateView=new DataView(this.nameTable1);
    this.nameTable2DateView=new DataView(this.nameTable2);
    this.nameTable3DateView=new DataView(this.nameTable3);
    this.nameTable4DateView=new DataView(this.nameTable4);
    this.palette=new ArrayBuffer(32);
    this.paletteDataView=new DataView(this.palette);
  }

  /** 扫描线渲染器用：每条扫描线时钟一次 MMC3 IRQ（约等于硬件 A12） */
  public clockMapperIrq():void{
    this.cartridgeReader?.mapper?.notifyA12Rise?.();
  }

  private nametableView(id:number):DataView{
    switch(id){
    case 2: return this.nameTable2DateView;
    case 3: return this.nameTable3DateView;
    case 4: return this.nameTable4DateView;
    default: return this.nameTable1DateView;
    }
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
      return this.nametableView(infor.nameTable).getUint8(infor.address);
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
      this.nametableView(infor.nameTable).setUint8(infor.address,value);
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
    // 四屏：四个独立 1KB 名称表
    case NametableType.FOUR_SCREEN:
      tableInfor.nameTable=1+((busAddress>>10)&3);
      break;
    default:
      tableInfor.nameTable=1;
      console.warn('没有找到名称表的镜像方式');
    }
    tableInfor.address=busAddress&0x3ff;
    return tableInfor;
  }
}