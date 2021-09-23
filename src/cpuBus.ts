import { CpuRam } from './cpuRam';
import {CartridgeReader} from './cartridge';
import { Cpu } from './cpu';
//CUP总线
export class CpuBus{
  //最初的2kb RAM
  private cpuRam:CpuRam;
  //CPU
  private cpu:Cpu;
  //卡带数据
  private cartridgeReader:CartridgeReader;
  //初始化CPU总线
  public init(_cartridgeReader:CartridgeReader,_cpu:Cpu):void{
    this.cartridgeReader=_cartridgeReader;
    this.cpu=_cpu;
    this.cpuRam=new CpuRam();
    console.log('初始化CPU总线`');
  }

  //清除
  public clear():void{
    this.cpuRam.clear();
    this.cpuRam=null;
    this.cartridgeReader=null;
  }

  /**
   * 从总线地址获取一个值
   * @param busAddress 总线地址 
   */
  public getValue(busAddress:number):number{
    //从RAM中获取
    if(busAddress>=0&&busAddress<0x2000){
      //截掉高位 RAM实际只有2kb
      return this.cpuRam.getBit(busAddress&0x7ff);
    }
    //从增加的RAM中获取
    else if(busAddress>=0x6000&&busAddress<0x8000){
      if(this.cartridgeReader.hasAddedRom){
        return this.cartridgeReader.mapper.cpuReadAddRom(busAddress);
      }else{
        console.warn('该卡带没有增加的RAM');
        return 0;
      }
    }
    //从卡带中获取
    else if(busAddress>=0x8000){
      return this.cartridgeReader.mapper.cpuReadRpg(busAddress);
    }
    else{
      console.warn('getValue时的CPU总线地址发生溢出');
      return 0;
    }
  }

  /**
   * 根据总线地址设置一个值
   * @param busAddress 总线地址
   * @param value 值
   */
  public setValue(busAddress:number,value:number):void{
    //RAM
    if(busAddress>=0&&busAddress<0x2000){
      this.cpuRam.setBit(busAddress&0x7ff,value);
    }
    //DMA
    //扩展RAM
    else if(busAddress>=0x6000&&busAddress<0x8000){
      if(this.cartridgeReader.hasAddedRom){
        this.cartridgeReader.mapper.cpuWriteAddRom(busAddress,value);
      }
    }
    //卡带
    else if(busAddress>=0x8000){
      this.cartridgeReader.mapper.cpuWriteRpg(busAddress,value);
    }else{
      console.warn('setValue时的CPU总线地址发生溢出');
    }
    //
  }

  //获取一页的数据
  public getPage(pageId:number):DataView{
    let address:number=pageId<<8;
    let dataView:DataView;
    //从RAM中获取
    if(address<0x2000){
      address=address&0x7ff;
      dataView=this.cpuRam.getPage(address);
    }
    //从增加的RAM中获取
    else if(address>=0x6000&&address<0x8000){
      if(this.cartridgeReader.hasAddedRom){
        return this.cartridgeReader.getPage(address-0x6000);
      }else{
        console.warn('该卡带没有增加的RAM');
      }
    }
    return dataView;
  }
}