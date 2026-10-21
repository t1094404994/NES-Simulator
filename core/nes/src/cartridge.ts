import { Mapper0 } from './mapper/mapper0';
import { Mapper1 } from './mapper/mapper1';
import { Mapper2 } from './mapper/mapper2';
import { Mapper3 } from './mapper/mapper3';
import { Mapper4 } from './mapper/mapper4';
import { Mapper7 } from './mapper/mapper7';
import { Mapper9 } from './mapper/mapper9';
import { Mapper11 } from './mapper/mapper11';
import { Mapper16 } from './mapper/mapper16';
import { Mapper23 } from './mapper/mapper23';
import { Mapper25 } from './mapper/mapper25';
import { Mapper33 } from './mapper/mapper33';
import { Mapper34 } from './mapper/mapper34';
import { Mapper66 } from './mapper/mapper66';
import { Mapper69 } from './mapper/mapper69';
import { Mapper71 } from './mapper/mapper71';
import { Mapper74 } from './mapper/mapper74';
import { Mapper75 } from './mapper/mapper75';
import { Mapper87 } from './mapper/mapper87';
import { Mapper118 } from './mapper/mapper118';
import { Mapper140 } from './mapper/mapper140';
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
  addRamDataView?:Uint8Array,
  /** MMC3 扫描线 IRQ 时钟（由 PPU 每扫描线调用一次） */
  notifyA12Rise?:()=>void,
  /** 绑定 IRQ 置位 / 应答回调 */
  bindIrq?:(tryIrq:()=>void,clearIrq?:()=>void)=>void,
  /** 扩展区 $4020–$5FFF 写入（如晶科泰 MMC3 的 $5000 外层 PRG） */
  cpuWriteExp?:WriteData,
  onFrameEnd?:()=>void,
  /** $6000–$7FFF 是寄存器（即使没有 WRAM 也要转发读写） */
  handles6000?:boolean,
  /** 每个 CPU 周期时钟一次（VRC / FME-7 / Bandai IRQ） */
  clockCpu?:()=>void,
  /** 按 PPU 地址选择名称表页。没有则用 nametableMirror。 */
  nametableIndex?:(ppuAddress:number)=>number,
  /** 电池档字节。没有则使用 addRam。 */
  exportBattery?:()=>Uint8Array,
  importBattery?:(data:Uint8Array)=>void,
}

const MAPPER_FACTORIES:Record<number,MapperCtor>={
  0:Mapper0,
  1:Mapper1,
  2:Mapper2,
  3:Mapper3,
  4:Mapper4,
  7:Mapper7,
  9:Mapper9,
  11:Mapper11,
  16:Mapper16,
  23:Mapper23,
  25:Mapper25,
  33:Mapper33,
  34:Mapper34,
  66:Mapper66,
  69:Mapper69,
  71:Mapper71,
  74:Mapper74,
  75:Mapper75,
  87:Mapper87,
  118:Mapper118,
  140:Mapper140,
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
  /** 电池内容变化。Nes 把它接到 onSaveDirty。 */
  public onBatteryDirty?:()=>void;
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
  public getPage(address:number):Uint8Array{
    if(!this.mapper.addRam){
      throw new Error('卡带没有 WRAM');
    }
    return new Uint8Array(this.mapper.addRam,address,256);
  }
}
