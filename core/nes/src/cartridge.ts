import { Mapper0 } from './mapper/mapper0';
import { Mapper1 } from './mapper/mapper1';
import { Mapper2 } from './mapper/mapper2';
import { Mapper3 } from './mapper/mapper3';
import { Mapper4 } from './mapper/mapper4';
import { Mapper7 } from './mapper/mapper7';
import { NametableType } from './nametableType';

type ReadData=(address:number)=>number;
type WriteData=(address:number,value:number)=>void;

type MapperCtor=new (cartridge:CartridgeReader,hasVrom:boolean)=>Mapper;

//MAPPER接口
export interface Mapper{
  //CPU读写0x6000-0xffff地址的数据
  cpuReadRpg:ReadData,
  cpuReadAddRom:ReadData,
  cpuWriteRpg:WriteData,
  cpuWriteAddRom:WriteData,
  //PPU读写图案表，切换名称表的映射方式
  ppuReadPt:ReadData,
  ppuWritePt:WriteData,
  //名称表镜像
  nametableMirror:number,
  //增加的RAM
  addRam?:ArrayBuffer,
  addRamDataView?:DataView,
  /** MMC3 扫描线 IRQ 时钟（由 PPU 每扫描线调用一次） */
  notifyA12Rise?:()=>void,
  /** 绑定 IRQ 置位 / 应答回调 */
  bindIrq?:(tryIrq:()=>void,clearIrq?:()=>void)=>void,
  /** 扩展区 $4020–$5FFF 写入（如晶科泰 MMC3 的 $5000 外层 PRG） */
  cpuWriteExp?:WriteData,
  onFrameEnd?:()=>void,
}

const MAPPER_FACTORIES:Record<number,MapperCtor>={
  0:Mapper0,
  1:Mapper1,
  2:Mapper2,
  3:Mapper3,
  4:Mapper4,
  7:Mapper7,
};

//卡带数据读取解析保存
export class CartridgeReader{
  //卡带数据
  public cartridgeData:ArrayBuffer;
  //数据视图
  public dataView:DataView;
  //卡带使用的MAPPER类型
  public mapperId:number;
  //MAPPER
  public mapper:Mapper;
  //卡带16kb程序块数量
  public romNum:number;
  //程序数据在卡带数据的起始位置
  public programOffset:number;
  //卡带8kb图集数量
  public vromNum:number;
  //图形数据在卡带中的起始位置
  public vromOffset:number;

  // iNES battery-backed PRG RAM 标志（bit1）；实际 WRAM 以 mapper.addRam 为准
  public hasAddedRom:boolean;
  constructor(){
    this.programOffset=16;
    this.hasAddedRom=false;
  }

  /** 卡带是否提供 $6000–$7FFF WRAM */
  public hasWram():boolean{
    return !!(this.mapper&&this.mapper.addRam);
  }
  
  //设置卡带数据
  public resetData(data:ArrayBuffer):boolean{
    this.cartridgeData=data;
    this.dataView=new DataView(this.cartridgeData);
    //文件头
    const head:number=this.dataView.getUint32(0,false);
    //文件头错误，重新读取 PS 检查文件头其实可有可无。
    if(!this.checkHeader(head)){
      this.clearData();
      return false;
    }
    //读取文件头里保存的各种信息
    this.romNum=this.dataView.getUint8(4);
    this.vromNum=this.dataView.getUint8(5);
    this.vromOffset=this.programOffset+this.romNum*16384;
    const flags6=this.dataView.getUint8(6);
    // bit0: 0=horizontal 1=vertical；bit3: four-screen
    const fourScreen=(flags6&0x08)!==0;
    const nameTableMirror=fourScreen
      ?NametableType.FOUR_SCREEN
      :((flags6&0x01)?NametableType.VIRTICAL:NametableType.HORIZONTAL);
    //MAPPER类型
    this.mapperId=((flags6>>4)&0xf)|(this.dataView.getUint8(7)&0xf0);
    console.log('当前卡带类型',this.mapperId);
    //有无电池 RAM 标志（兼容旧逻辑）；WRAM 由 mapper 自带 addRam
    this.hasAddedRom=(flags6&0x2)!==0;

    const Factory=MAPPER_FACTORIES[this.mapperId];
    if(!Factory){
      throw new Error('目前不支持 mapper '+this.mapperId);
    }
    this.mapper=new Factory(this,this.vromNum!==0);
    this.mapper.nametableMirror=nameTableMirror;
    return true;
  }

  //清除卡带数据
  public clearData():void{
    this.cartridgeData=null;
    this.dataView=null;
  }

  //检查文件头
  private checkHeader(head:number):boolean{
    if(head===0x4e45531a){
      return true;
    }else{
      return false;
    }
  }

  //获取 WRAM 一页的数据视图（offset 相对 $6000）
  public getPage(address:number):DataView{
    if(!this.mapper.addRam){
      throw new Error('卡带没有 WRAM');
    }
    return new DataView(this.mapper.addRam,address,256);
  }
}
