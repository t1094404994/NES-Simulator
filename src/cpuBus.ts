import { CpuRam } from './cpuRam';
import {CartridgeReader} from './cartridge';
import { Cpu } from './cpu';
import { Ppu } from './ppu';
import { Controller } from './controller';
import { Apu } from './apu';
//CUP总线
export class CpuBus{
  //最初的2kb RAM
  private cpuRam:CpuRam;
  //CPU
  private cpu:Cpu;
  //卡带数据
  private cartridgeReader:CartridgeReader;
  //PPU
  private ppu:Ppu;

  //APU
  private apu:Apu;
  //手柄
  private controllerL:Controller;
  private controllerR:Controller;
  // 简易 open bus：不可读的 PPU 寄存器应返回总线残留值，而非 warn
  private openBus:number;
  constructor(){
    this.cpuRam=new CpuRam();
    this.openBus=0;
  }

  public setCartridgeReader(_cartridgeReader:CartridgeReader):void{
    this.cartridgeReader=_cartridgeReader;
    this.cartridgeReader.mapper?.bindIrq?.(
      ()=>this.tryIRQ(),
      ()=>this.IrqAcknowledge()
    );
  }

  private hasWram():boolean{
    return !!(this.cartridgeReader&&this.cartridgeReader.hasWram());
  }

  public setCpu(_cpu:Cpu):void{
    this.cpu=_cpu;
  }

  public getCpu():Cpu{
    return this.cpu;
  }

  public setPpu(_ppu:Ppu):void{
    this.ppu=_ppu;
  }

  public setApu(_apu:Apu):void{
    this.apu=_apu;
  }

  public setControllerL(controller:Controller):void{
    this.controllerL=controller;
  }
  public setControllerR(controller:Controller):void{
    this.controllerR=controller;
  }
  //清除
  public clear():void{
    this.cpuRam.clear();
    this.cpuRam=null;
    this.cartridgeReader=null;
    this.cpu=null;
    this.ppu=null;
  }

  /**
   * 从总线地址获取一个值
   * @param busAddress 总线地址 
   */
  public getValue(busAddress:number):number{
    let value=this.openBus;
    //从RAM中获取
    if(busAddress>=0&&busAddress<0x2000){
      //截掉高位 RAM实际只有2kb
      value=this.cpuRam.getBit(busAddress&0x7ff);
    }
    //从PPU中获取
    else if(busAddress>=0x2000&&busAddress<0x4000){
      switch(busAddress&0x2007){
      case 0x2000:
      case 0x2001:
      case 0x2003:
      case 0x2005:
      case 0x2006:
        // 只写寄存器：读返回 open bus（游戏会合法地读这些地址）
        value=this.openBus;
        break;
      case 0x2002:
        value=this.ppu.getStatus();
        break;
      case 0x2004:
        value=this.ppu.getOamdata();
        break;
      case 0x2007:
        value=this.ppu.readData();
        break;
      }
    }
    else if(busAddress===0x4015){
      value=this.apu.read4015();
    }
    //手柄
    else if(busAddress===0x4016){
      value=this.controllerL.getKeyState();
    }
    else if(busAddress===0x4017){
      value=this.controllerR.getKeyState();
    }
    else if(busAddress >= 0x4000 && busAddress < 0x6000){
      value=this.openBus;
    }
    //从增加的RAM中获取（以 mapper.addRam 为准，不限于 battery 位）
    else if(busAddress>=0x6000&&busAddress<0x8000){
      if(this.hasWram()){
        value=this.cartridgeReader.mapper.cpuReadAddRom(busAddress);
      }else{
        value=this.openBus;
      }
    }
    else{
      value=this.cartridgeReader.mapper.cpuReadRpg(busAddress);
    }
    this.openBus=value&0xff;
    return this.openBus;
  }

  /**
   * 根据总线地址设置一个值
   * @param busAddress 总线地址
   * @param value 值
   */
  public setValue(busAddress:number,value:number):void{
    this.openBus=value&0xff;
    //RAM
    if(busAddress>=0&&busAddress<0x2000){
      this.cpuRam.setBit(busAddress&0x7ff,value);
    }
    //PPU寄存器
    else if(busAddress>=0x2000&&busAddress<0x4000){
      //console.log('CPU写入数值'+value+'到PPU寄存器'+busAddress.toString(16));
      switch(busAddress&0x2007){
      case 0x2000:
        this.ppu.writeCtrl(value);
        break;
      case 0x2001: //PPUMASK
        this.ppu.writeMask(value);
        break;
      case 0x2002:
        console.warn('CPU不能写入数据到PPU状态寄存器');
        break;
      case 0x2003:
        this.ppu.writeOamaddr(value);
        break;
      case 0x2004:
        this.ppu.writeOamdata(value);
        break;
      case 0x2005:
        this.ppu.writeScroll(value);
        break;
      case 0x2006:
        this.ppu.writeAddr(value);
        break;
      case 0x2007:
        this.ppu.writeData(value);
        break;
      }
    }
    //DMA CPU直接把256字节精灵RAM的引用数据传入PPU
    else if(busAddress===0x4014){
      //console.log('CPU直接把'+value.toString(16)+'起始的精灵RAM的引用数据传入PPU');
      this.cpu.dmaSleep();
      const page:DataView=this.getPage(value);
      this.ppu.oamDma(page);
    }
    //手柄
    else if(busAddress===0x4016){
      this.controllerL.setStrobe(value);
      this.controllerR.setStrobe(value);
    }
    else if(busAddress >= 0x4000 && busAddress < 0x4018){
      //
      this.apu.setData(busAddress-0x4000,value);
    }
    else if(busAddress >= 0x4018 && busAddress < 0x6000){
      //
    }
    //扩展RAM
    else if(busAddress>=0x6000&&busAddress<0x8000){
      if(this.hasWram()){
        this.cartridgeReader.mapper.cpuWriteAddRom(busAddress,value);
      }
    }
    //卡带
    else{
      this.cartridgeReader.mapper.cpuWriteRpg(busAddress,value);
    }
    // //卡带
    // else if(busAddress>=0x8000){
    //   this.cartridgeReader.mapper.cpuWriteRpg(busAddress,value);
    // }else{
    //   console.warn('setValue时的CPU总线地址发生溢出');
    // }
    //
  }

  //获取一页（256 字节）数据，供 $4014 OAM DMA 使用；支持 RAM / WRAM / PRG
  public getPage(pageId:number):DataView{
    const address=(pageId&0xff)<<8;
    if(address<0x2000){
      return this.cpuRam.getPage(address&0x700);
    }
    if(address>=0x6000&&address<0x8000&&this.hasWram()){
      return this.cartridgeReader.getPage(address-0x6000);
    }
    // PRG ROM 或其他区域：逐字节读取到临时缓冲
    const buf=new ArrayBuffer(256);
    const view=new DataView(buf);
    for(let i=0;i<256;i++){
      view.setUint8(i,this.getValue(address+i));
    }
    return view;
  }

  //尝试IRQ中断
  public tryIRQ():void{
    if(this.cpu.regSf.getI()){
      this.cpu.irqFlag=1;
    }else{
      this.cpu.irqCounter=1;
    }
  }

  //清除IRQ
  public IrqAcknowledge():void{
    this.cpu.irqFlag=0;
    this.cpu.irqCounter=0;
  }

  //获取该帧的cpu周期
  public getCpuCycleFrame():number{
    return this.cpu.cycleFrame;
  }
}