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
  public bytes:Uint8Array;
  constructor(){
    this.bytes=new Uint8Array(256);
  }
  public reset():void{
    this.bytes.fill(0);
  }

  public setData(address:number,value:number):void{
    this.bytes[address]=value;
  }

  public getData(address:number):number{
    return this.bytes[address];
  }

  //普通8x8的精灵
  public getOneSprite(id:number):OAMSprite{
    const sprite:OAMSprite={locX:0,locY:0,patterntableAddress:0,paletteDx:0,flipX:false,flipY:false,behindBackground:false};
    const offset:number=id*4;
    const bytes=this.bytes;
    sprite.locY=bytes[offset];
    sprite.patterntableAddress=bytes[offset+1]*16;
    const bit3:number=bytes[offset+2];
    sprite.paletteDx=bit3&0x3;
    sprite.behindBackground=(bit3&(1<<5))!==0;
    // Nesdev: OAM byte2 bit6 = horizontal flip when set
    sprite.flipX=(bit3&(1<<6))!==0;
    // Nesdev: OAM byte2 bit7 = vertical flip when set
    sprite.flipY=(bit3&(1<<7))!==0;
    sprite.locX=bytes[offset+3];
    return sprite;
  }
  //特殊的8x16的精灵
  public getOneSpriteLong(id:number):OAMSprite{
    const sprite:OAMSprite={locX:0,locY:0,patterntableAddress:0,paletteDx:0,flipX:false,flipY:false,behindBackground:false};
    const offset:number=id*4;
    const bytes=this.bytes;
    sprite.locY=bytes[offset];
    // Nesdev 8x16: bit0 选图案表 $0000/$1000，bit7-1 为顶层 tile（偶数编号）
    const tileByte=bytes[offset+1];
    const bank=(tileByte&1)*0x1000;
    const topTile=tileByte&0xfe;
    sprite.patterntableAddress=(bank+topTile*16)&0xffff;
    const bit3:number=bytes[offset+2];
    sprite.paletteDx=bit3&0x3;
    sprite.behindBackground=(bit3&(1<<5))!==0;
    sprite.flipX=(bit3&(1<<6))!==0;
    sprite.flipY=(bit3&(1<<7))!==0;
    sprite.locX=bytes[offset+3];
    return sprite;
  }
}

//PPU总线
export class PpuBus{
  /** 名称表、图案表、调色板或 mapper 换 bank 后加一，渲染缓存据此失效。 */
  public vramEpoch=0;
  //1kb 32x32名称表（四屏时用到 0–3）
  private nameTables:Uint8Array[];
  //32字节调色板
  private palette:Uint8Array;
  //卡带
  private cartridgeReader:CartridgeReader;
  constructor(){
    this.nameTables=[
      new Uint8Array(1024),
      new Uint8Array(1024),
      new Uint8Array(1024),
      new Uint8Array(1024),
    ];
    this.palette=new Uint8Array(32);
  }

  public bump():void{
    this.vramEpoch++;
  }

  //重置所有数据
  public reset():void{
    for(let i=0;i<4;i++) this.nameTables[i].fill(0);
    this.palette.fill(0);
    this.vramEpoch++;
  }

  /** 扫描线渲染器用：每条扫描线时钟一次 MMC3 IRQ（约等于硬件 A12） */
  public clockMapperIrq():void{
    this.cartridgeReader?.mapper?.notifyA12Rise?.();
  }

  private nametableIndex(busAddress:number):number{
    switch(this.cartridgeReader.mapper.nametableMirror){
    //水平镜像 排布为名称表1|名称表1 |(0x800)名称表2|名称表2
    case NametableType.HORIZONTAL:
      return (busAddress&0x800)?1:0;
    //垂直镜像
    case NametableType.VIRTICAL:
      return (busAddress&0x400)?1:0;
    //只有名称表2
    case NametableType.ONESCREEN_HIGHER:
      return 1;
    // 四屏：四个独立 1KB 名称表
    case NametableType.FOUR_SCREEN:
      return (busAddress>>10)&3;
    //只有名称表1，以及未知镜像
    default:
      return 0;
    }
  }

  //设置卡带
  public setCartridgeReader(_cartridgeReader:CartridgeReader):void{
    this.cartridgeReader=_cartridgeReader;
  }
  //从PPU总线获取数据
  public getValue(busAddress:number):number{
    //获取图案表数据
    if(busAddress<0x2000){
      return this.cartridgeReader.mapper.ppuReadPt(busAddress);
    }
    //获取名称表数据
    if(busAddress<0x3f00){
      return this.nameTables[this.nametableIndex(busAddress)][busAddress&0x3ff];
    }
    if(busAddress<0x4000){
      return this.palette[busAddress&0x1f];
    }
    return 0;
  }

  //从PPU总线设置数据
  public setValue(busAddress:number,value:number):void{
    //尝试写入数据到卡带
    if(busAddress<=0x1fff){
      this.cartridgeReader.mapper.ppuWritePt(busAddress,value);
    }
    //写入数据到名称表
    else if(busAddress<0x3f00){
      this.nameTables[this.nametableIndex(busAddress)][busAddress&0x3ff]=value;
    }
    //写入数据到调色板
    else if(busAddress<0x4000){
      let address:number= busAddress & 0x1f;
      if (address === 0x10)
        address = 0x0;
      else if (address === 0x14)
        address = 0x4;
      else if (address === 0x18)
        address = 0x8;
      else if (address === 0x1c)
        address = 0xc;
      this.palette[address]=value;
    }
    else{
      return;
    }
    this.bump();
  }
}
