import {Mapper,CartridgeReader} from '../cartridge';
import {NametableType} from '../ppuBus';
//Mapper1的扩展寄存器
class RegCtrl{
  private data:number
  constructor(){
    this.data=0;
  }
  public getData():number{
    return this.data;
  }

  public setData(_data:number):void{
    this.data=_data;
  }

  public getPatternBankMode():boolean{ //第4位表示图案表的寻址方式
    if (this.data & 0x10) return true;
    else return false;
  }
  public getNametableMirror():number{ //第0-1位表示命名表的映射关系
    return (this.data & 0x03);
  }
  public getProgramBankMode():number{ //第2-3位表示代码段的寻址方式
    return ((this.data >> 2) & 0x03);
  }
  public setProgramBankMode(prgMode:number):void{
    this.data &= 0x13;
    this.data |= ((prgMode & 0x3) << 2);
  }
}

export class Mapper1 implements Mapper{
  //TODO如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 卡带上为什么会没有图案表？
  private chRamPtr:ArrayBuffer;
  private chRamPtrDataView:DataView;
  //扩展的RAM
  public addRam:ArrayBuffer;
  public addRamDataView:DataView;
  //RPG数据视图
  private rpgDataView:DataView;
  //vRom数据视图
  private vromDataView:DataView;
  //卡带
  private cartridge:CartridgeReader;
  //reg_ctrl
  private regCtrl:RegCtrl
  public nametableMirror:number;

  //Mapper1扩展的寄存器：已经写了多少次(0-5)
  private numWrite:number
  //Mapper1扩展的寄存器：目前的输入值是多少
  private regLoad:number
  //
  private ptSelect4kbLo:number;
  private ptSelect4kbHi:number;
  private ptSelect8kb:number;

  private prgSelect16kbLo:number;
  private prgSelect16kbHi:number;
  public prgSelect32kb:number;
  constructor(cartridge:CartridgeReader,hasVrom:boolean){
    //如果卡带上没有图案表的话，则新建一块8KB的ram作为图案表 
    this.reset(cartridge,hasVrom);
  }

  //初始化信息
  public reset(_cartridge:CartridgeReader,hasVrom:boolean):void{
    if(!hasVrom){
      this.chRamPtr=new ArrayBuffer(0x2000);
      this.chRamPtrDataView=new DataView(this.chRamPtr);
    }else{
      this.chRamPtr=null;
      this.chRamPtrDataView=null;
    }
    this.addRam=new ArrayBuffer(0x2000);
    this.addRamDataView=new DataView(this.addRam);
    //重置
    this.regCtrl=new RegCtrl();
    this.regCtrl.setData(0x1c);
    this.cartridge=_cartridge;
    //根据卡带数据 设置RPG和VROM数据视图
    this.rpgDataView=new DataView(this.cartridge.cartridgeData,this.cartridge.programOffset,this.cartridge.romNum*16384);
    this.vromDataView=new DataView(this.cartridge.cartridgeData,this.cartridge.vromOffset);
    //重置
    this.numWrite=0;
    this.regLoad=0;
    this.ptSelect4kbLo = 0;
    this.ptSelect4kbHi = 0;
    this.ptSelect8kb = 0;
    this.prgSelect16kbLo = 0;
    this.prgSelect16kbHi = this.cartridge.romNum - 1;
    this.prgSelect32kb = 0;
    
  }

  public clear():void{
    this.chRamPtrDataView=null;
    this.rpgDataView=null;
    this.vromDataView=null;
    this.chRamPtr=null;
    this.cartridge=null;
  }
  //CPU读取程序数据
  public cpuReadRpg(busAddress:number):number{
    let programAddr:number;
    if (this.regCtrl.getProgramBankMode() >= 2){
      //CPU读取两个16KB的代码段
      if (busAddress <= 0xbfff){
        programAddr = 0x4000 * this.prgSelect16kbLo + (busAddress & 0x3fff);
      }else{
        programAddr = 0x4000 * this.prgSelect16kbHi + (busAddress & 0x3fff);
      }
    }else{
      //CPU读取一个32KB的代码段
      programAddr = 0x8000 * this.prgSelect32kb + (busAddress & 0x7fff);
    }
    return this.rpgDataView.getUint8(programAddr);
  }
  //CPU写入程序数据
  public cpuWriteRpg(busAddress:number,value:number):void{
    if (value & 0x80){
      //根据Mapper1的定义，当data的最高位为1时，清掉缓存
      this.regLoad = 0;
      this.numWrite = 0;
      this.regCtrl.setProgramBankMode(3);
    }else{
      const inputFlag:number = (value & 0x01);
      this.regLoad >>= 1;
      this.regLoad |= (inputFlag << 4);
      this.numWrite++;
      if (this.numWrite === 5){
        //连续输入五次后，做出对应的控制调整
        if (busAddress >= 0x8000 && busAddress <= 0x9fff){
          //向0x8000-0x9fff写入数据，调整命名表的映射关系
          this.regCtrl.setData(this.regLoad & 0x1f);
          switch(this.regCtrl.getNametableMirror()){
          case 0:
            this.nametableMirror = NametableType.ONESCREEN_LOWER;
            break;
          case 1:
            this.nametableMirror = NametableType.ONESCREEN_HIGHER;
            break;
          case 2:
            this.nametableMirror = NametableType.VIRTICAL;
            break;
          case 3:
            this.nametableMirror = NametableType.HORIZONTAL;
            break;
          }
        }else if (busAddress >= 0xa000 && busAddress <= 0xbfff){
          //向0xa000-0xbfff写入数据，调整图案表的寻址结果
          //模式为1时，PPU分成两个4KB的图案表来读取，调整图案表（0X0000-0X1000）的寻址结果
          //模式为0时，PPU读取一个8KB的图案表，调整图案表（0X0000-0X2000）的寻址结果
          if (this.regCtrl.getPatternBankMode()){
            this.ptSelect4kbLo = this.regLoad & 0x1f;
          }else{
            this.ptSelect8kb = this.regLoad & 0x1f;
          }
        }else if (busAddress >= 0xc000 && busAddress <= 0xdfff){
          //向0xc000-0xdfff写入数据，调整图案表的寻址结果
          //模式为1时，PPU分成两个4KB的图案表来读取，调整图案表（0X1000-0X2000）的寻址结果
          //模式为0时，PPU读取一个8KB的图案表，在此处输出无效
          if (this.regCtrl.getPatternBankMode()){
            this.ptSelect4kbHi = this.regLoad & 0x1f;
          }
        }else if (busAddress >= 0xe000 && busAddress <= 0xffff){
          const programBankMode:number = this.regCtrl.getProgramBankMode();
          if (programBankMode === 0 || programBankMode === 1){
            //向0xe000-0xffff写入数据，调整程序代码的寻址结果
            //模式为0或1时，CPU读取一个32KB的代码段。调整程序代码（0X8000-0Xffff）的寻址结果
            //模式为2或3时，CPU读取两个16KB的代码段，按照相应规则调整程序代码的寻址结果
            this.prgSelect32kb = ((this.regLoad & 0x0e) >> 1);
          }else if (programBankMode === 2){
            this.prgSelect16kbHi = (this.regLoad & 0x0f);
            this.prgSelect16kbLo = 0;
          }else if (programBankMode === 3){
            this.prgSelect16kbHi = this.cartridge.romNum - 1;
            this.prgSelect16kbLo = (this.regLoad & 0x0f);
          }
        }
        this.regLoad = 0;
        this.numWrite = 0;
      }
    }
  }
  //CPU读取的扩展ROM
  public cpuReadAddRom(busAddress:number):number{
    //因为卡带数据在总线中从0x8000 二进制即10000000 0000000  所以只需把最高位截掉，即可得到相对于卡带的位置 
    //TODO注意，文件头不占据总线中的位置 不确定
    return this.addRamDataView.getUint8(busAddress-0x6000);
  }
  //CPU写入扩展ROM
  public cpuWriteAddRom(busAddress:number,value:number):void{
    return this.addRamDataView.setUint8(busAddress-0x6000,value);
  }

  //PPU读取图案表 ppu总线地址
  public ppuReadPt(busAddress:number):number{
    if(this.cartridge.vromNum===0){
      return this.chRamPtrDataView.getUint8(busAddress);
    }else{
      let vromAddr:number;
      if (this.regCtrl.getPatternBankMode()){
        //模式为1时，PPU分成两个4KB的图案表来读取
        if (busAddress <= 0x0fff){
          vromAddr = 0x1000 * this.ptSelect4kbLo + (busAddress & 0x0fff);
        }else{
          vromAddr = 0x1000 * this.ptSelect4kbHi + (busAddress & 0x0fff);
        }
      }else{
        //模式为0时，PPU读取一个8KB的图案表
        vromAddr = 0x2000 * this.ptSelect8kb + (busAddress & 0x1fff);
      }
      return this.vromDataView.getUint8(vromAddr);
    }
  }

  //PPU写入图案表
  public ppuWritePt(busAddress:number,value:number):void{
    if(this.cartridge.vromNum===0){
      this.chRamPtrDataView.setUint8(busAddress,value);
    }else{
      console.warn(busAddress+':'+value+'卡带VROM不能写入');
    }
  }
}