//CPU RAM 实际可用为2kb  0-255bit为零页,256-511bit为栈空间,剩下为游戏程序自由操作的空间
export class CpuRam{
  private ram:ArrayBuffer;
  private ramView:DataView;
  private addressMax:number;
  private bit8Max:number;
  constructor(){
    this.addressMax=0x7ff;
    this.bit8Max=0xff;
    this.resetRam();
  }
  
  public resetRam():void{
    this.ram=new ArrayBuffer(2048);
    this.ramView=new DataView(this.ram);
  }

  /**
   * 设置RAM的数据
   * @param address 16bit地址 
   * @param value 数值
   * @returns 
   */
  public setBit(address:number,value:number):void{
    //切掉高位(如果有) 防止溢出
    // address=address&this.addressMax;
    // value=value&this.bit8Max;
    if(address>this.addressMax){
      throw new Error('地址超过最大值');
    }
    if(value>this.bit8Max){
      throw new Error('数值超过八位最大值');
    }
    this.ramView.setUint8(address,value);
  }
  
  /**
   * 获取RAM对应地址的数值
   * @param address 地址
   * @returns 
   */
  public getBit(address:number):number{
    if(address>this.addressMax){
      throw new Error('地址超过最大值');
    }
    return this.ramView.getUint8(address);
  }
}