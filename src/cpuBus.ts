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
  constructor(){
    this.cpuRam=new CpuRam();
  }

  public setCartridgeReader(_cartridgeReader:CartridgeReader):void{
    this.cartridgeReader=_cartridgeReader;
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
    //从RAM中获取
    if(busAddress>=0&&busAddress<0x2000){
      //截掉高位 RAM实际只有2kb
      return this.cpuRam.getBit(busAddress&0x7ff);
    }
    //从PPU中获取
    else if(busAddress>=0x2000&&busAddress<0x4000){
      switch(busAddress&0x2007){
      case 0x2000:
        console.warn('CPU不能取得PPU  0x2000');
        return 0;
      case 0x2001:
        console.warn('CPU不能取得PPU  0x2001');
        return 0;
      case 0x2002:
        return this.ppu.getStatus();
      case 0x2003:
        console.warn('CPU不能取得PPU  0x2003');
        return 0;
      case 0x2004:
        return this.ppu.getOamdata();
      case 0x2005:
        console.warn('CPU不能取得PPU  0x2004');
        return 0;
      case 0x2006:
        console.warn('CPU不能取得PPU  0x2006');
        return 0;
      case 0x2007:
        return this.ppu.readData();
      }
    }
    else if(busAddress===0x4015){
      return this.apu.read4015();
    }
    //手柄
    else if(busAddress===0x4016){
      return this.controllerL.getKeyState();
    }
    else if(busAddress===0x4017){
      return this.controllerR.getKeyState();
    }
    else if(busAddress >= 0x4000 && busAddress < 0x6000){
      return 0;
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
    else{
      return this.cartridgeReader.mapper.cpuReadRpg(busAddress);
    }
    //从卡带中获取
    // else if(busAddress>=0x8000){
    //   return this.cartridgeReader.mapper.cpuReadRpg(busAddress);
    // }
    // else{
    //   console.warn('getValue时的CPU总线地址发生溢出');
    //   return 0;
    // }
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
      if(this.cartridgeReader.hasAddedRom){
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
}