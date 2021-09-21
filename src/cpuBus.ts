import { CpuRam } from './cpuRam';
import {CartridgeReader} from './cartridge';
//CUP总线
export class CpuBus{
  //最初的2kb RAM
  private cpuRam:CpuRam;
  //卡带数据
  private cartridgeReader:CartridgeReader;
  constructor(){
    this.init();
  }

  //初始化CPU总线
  public init():void{
    this.cpuRam=new CpuRam();
    this.cartridgeReader=new CartridgeReader();
    console.log('初始化CPU总线`');
  }

  //初始化卡带数据
  public setCartridgeData(data:ArrayBuffer):void{
    this.cartridgeReader.resetData(data);
  }

  //清除
  public clear():void{
    this.cpuRam.clear();
    this.cpuRam=null;
    this.cartridgeReader.clearData();
    this.cartridgeReader=null;
  }

  /**
   * 从总线地址获取一个值
   * @param busAddress 总线地址 
   */
  public getValue(busAddress:number):number{
    //从RAM中获取
    if(busAddress<0x2000){
      //截掉高位 RAM实际只有2kb
      return this.cpuRam.getBit(busAddress&0x7ff);
    }
    //从增加的RAM中获取
    else if(busAddress>=0x6000&&busAddress<0x8000){
      if(this.cartridgeReader.hasAddedRom){
        return this.cartridgeReader.mapper.cpuReadAddRom(busAddress);
      }else{
        console.warn('该卡带没有增加的RAM');
      }
    }
    //从卡带中获取
    else if(busAddress>=0x8000){
      return this.cartridgeReader.mapper.cpuReadRpg(busAddress);
    }
    else{
      return 0;
    }
  }

  /**
   * 根据总线地址设置一个值
   * @param busAddress 总线地址
   * @param value 值
   */
  public setValue(busAddress:number,value:number):void{
    if(busAddress<0x2000){
      this.cpuRam.setBit(busAddress&0x7ff,value);
    }else if(busAddress>=0x6000&&busAddress<0x8000){
      if(this.cartridgeReader.hasAddedRom){
        this.cartridgeReader.mapper.cpuWriteAddRom(busAddress,value);
      }
    }else if(busAddress>=0x8000){
      this.cartridgeReader.mapper.cpuWriteRpg(busAddress,value);
    }
    //
  }
}