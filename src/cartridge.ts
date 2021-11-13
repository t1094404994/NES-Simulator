import { Mapper0 } from './mapper/mapper0';
import { Mapper1 } from './mapper/mapper1';
import { Mapper2 } from './mapper/mapper2';

type ReadData=(address:number)=>number;
type WriteData=(address:number,value:number)=>void;

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
}

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

  //卡带是否有多的ROM
  public hasAddedRom:boolean;
  constructor(){
    this.programOffset=16;
    this.hasAddedRom=false;
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
    //这个卡带规定的nametable的镜像方式
    const nameTableMirror:number= this.dataView.getUint8(6) & 0xb;
    //MAPPER类型
    this.mapperId= ((this.dataView.getUint8(6) >> 4) & 0xf) | (this.dataView.getUint8(7) & 0xf0);
    //有无增加ROM
    this.hasAddedRom=(this.dataView.getUint8(6) & 0x2)!==0;
    if(this.mapperId===0){
      this.mapper=new Mapper0(this,this.vromNum!==0);
      this.mapper.nametableMirror=nameTableMirror;
    }
    else if(this.mapperId===1){
      this.mapper=new Mapper1(this,this.vromNum!==0);
      this.mapper.nametableMirror=nameTableMirror;
    }
    else if(this.mapperId===2){
      this.mapper=new Mapper2(this,this.vromNum!==0);
      this.mapper.nametableMirror=nameTableMirror;
    }
    else{
      throw new Error('目前不支持'+this.mapperId);
      
    }
    //MAPPER
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

  //获取一页的数据
  public getPage(address:number):DataView{
    return new DataView(this.mapper.addRam,address,256);
  }
}