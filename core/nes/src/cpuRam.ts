//CPU RAM 实际可用为2kb  0-255bit为零页,256-511bit为栈空间,剩下为游戏程序自由操作的空间
export class CpuRam{
  private ram:Uint8Array;
  constructor(){
    this.ram=new Uint8Array(2048);
  }

  public resetRam():void{
    this.ram.fill(0);
  }

  public clear():void{
    this.ram=null;
  }

  public setBit(address:number,value:number):void{
    this.ram[address]=value;
  }

  public getBit(address:number):number{
    return this.ram[address];
  }

  public getPage(address:number):Uint8Array{
    return this.ram.subarray(address,address+256);
  }
}
