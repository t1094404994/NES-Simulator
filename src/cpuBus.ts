import { CpuRam } from './cpuRam';

//CUP总线
export class CpuBus{
  private cpuRam:CpuRam;
  constructor(){
    this.init();
  }

  //初始化CPU总线
  public init():void{
    this.cpuRam=new CpuRam();
    console.log('初始化CPU总线`');
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
    }else{
      return 0;
    }
  }

  /**
   * 根据总线地址设置一个值
   * @param busAddress 总线地址
   * @param value 值
   */
  public setValue(busAddress:number,value:number):void{
    //TODO OVER 8bit MAX
    if(busAddress<0x2000){
      this.cpuRam.setBit(busAddress&0x7ff,value);
    }
  }
}