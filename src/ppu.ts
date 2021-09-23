import { OAMRAM, PpuBus } from './ppuBus';

//PPU控制寄存器 CPU总线的0x2000
export class PpuCtrl{
  private data:number;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.data=0;
  }
  public setData(value:number):void{
    this.data=value;
  }
  public getData():number{
    return this.data;
  }
  //bit0,bit1位 确定使用哪个名称表nametable
  public getBasentable():number{
    return this.data & 3;
  }
  //bit2 PPU读写显存增量
  public getAddrincrement():number{
    if (this.data  & (1 << 2)) return 32;
    else return 1;
  }
  //bit3 精灵使用哪个图案表的标志位。当标志位为1时，使用0x1000-0x1fff的图案表，否则用0x0000-0x0fff的
  public getSptableDx():number{ 
    if (this.data  & (1 << 3)) return 1;
    else return 0;
  }
  //bit4 背景使用哪个图案表的标志位。当标志位为1时，使用0x1000-0x1fff的图案表，否则用0x0000-0x0fff的
  public getBptableDx():number{
    if (this.data  & (1 << 4)) return 1;
    else return 0;
  }
  //bit5 获取精灵大小标志位。当标志位为1时，sprite大小更大
  public getSpriteSize():number{
    if (this.data  & (1 << 5)) return 1;
    else return 0;
  }
  //bit6 ppu主/从模式 FC没有用到
  //bit7  获取是否在绘制结束后给CPU提供一个nmi中断的标志位
  public getNmi():number{
    if (this.data  & (1 << 7)) return 1;
    else return 0;
  }
}

//PPU掩码寄存器 CPU总线的0x2001
export class PpuMask{
  private data:number;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.data=0;
  }
  public setData(value:number):void{
    this.data=value;
  }
  public getData():number{
    return this.data;
  }

  //bit0  0彩色 1灰色
  public getGreymode():number{
    if(this.data&1) return 1;
    else return 0;
  }
  //bit1 获取是否展示最左边八个像素背景的标志位
  public getShowedgebkg():number{
    if (this.data & (1 << 1)) return 1;
    else return 0;
  }
  //bit2 获取是否显示最左边八个像素精灵的标志位
  public getShowedgespr():number{ 
    if (this.data & (1 << 2)) return 1;
    else return 0;
  }
  //bit3 获取是否显示背景的标志位
  public getShowbkg():number{ 
    if (this.data & (1 << 3)) return 1;
    else return 0;
  }
  //bit4 //获取是否显示精灵的标志位
  public getShowspr():number{ 
    if (this.data & (1 << 4)) return 1;
    else return 0;
  }
  //bit5,6,7 NTSC PAL 颜色强调使能标志位 rgb
}

//PPU状态寄存器 CPU总线的0x2002
export class PpuStatus{
  private data:number;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.data=0;
  }
  public setData(value:number):void{
    this.data=value;
  }
  public getData():number{
    return this.data;
  }

  public getSproverflow():number{
    if (this.data & (1 << 5)) return 1;
    else return 0;
  }
  public getSpr0hit():number{
    if (this.data & (1 << 6)) return 1;
    else return 0;
  }
  public getVblank():number{ //当前是否处在垂直消隐的阶段
    if (this.data & (1 << 7)) return 1;
    else return 0;
  }
  public setSproverflow(n:boolean):void{
    if (n) this.data |= 1 << 5;
    else this.data &= 0xdf;
  }
  public setSpr0hit(n:boolean):void{
    if (n) this.data |= 1 << 6;
    else this.data &= 0xbf;
  }
  public setVblank(n:boolean):void{ //设置垂直消隐的标志位
    if (n) this.data |= 1 << 7;
    else this.data &= 0x7f;
  }
}

export class REGV{
  private data:number;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.data=0;
  }
  public setData(value:number):void{
    this.data=value;
  }
  public getData():number{
    return this.data;
  }

  //设置寄存器的低八位值
  public setLow8(value:number):void{
    this.data &= 0xff00;
    this.data |= value;
  }
  //设置寄存器的9-14位值. 更高的数值会被映射下去
  public setHi6(value:number):void{ 
    this.data &= 0x00ff;
    this.data |= ((value & 0x3f) << 8);
  }
  //设置NameTable的数值
  public setNametable(value:number):void{ 
    this.data &= 0xf3ff;
    this.data |= ((value & 0x3) << 10);
  }
  //设置NameTable_X的数值
  public setNametable_x(value:number):void{ 
    if (value) this.data |= 1 << 10;
    else this.data &= 0xfbff;
  }
  //设置NameTable_Y的数值
  public setNametable_y(value:number):void{ 
    if (value) this.data |= 1 << 11;
    else this.data &= 0xf7ff;
  }
  //设置x_scroll的数值
  public setXscroll(value:number):void{ 
    this.data &= 0xffe0;
    this.data |= (value & 0x1f);
  }
  //设置y_scroll的数值
  public setYscroll(value:number):void{ 
    this.data &= 0xfc1f;
    this.data |= ((value & 0x1f) << 5);
  }
  //设置y_fine的数值
  public setYfine(value:number):void{
    this.data &= 0x8fff;
    this.data |= ((value & 0x7) << 12);
  }
  //获取x_scroll的数值
  public getXscroll():number{ 
    return this.data & 0x1f;
  }
  public getNametable_x():number{
    if (this.data & (1 << 10)) return 1;
    else return 0;
  }
  public getNametable_y():number{
    if (this.data & (1 << 11)) return 1;
    else return 0;
  }
  //获取y_scroll的数值
  public getYscroll():number{ 
    return (this.data & 0x3e0) >> 5;
  }
  //获取y_fine的数值
  public getYfine():number{ 
    return (this.data & 0x7000) >> 12;
  }
}

//PPU
export class Ppu{
  //寄存器

  //PPU控制寄存器 0x2000
  public regCtrl:PpuCtrl;
  //PPU掩码寄存器 0x2001
  public regMask:PpuMask;
  //PPU状态寄存器 0x2002
  public regStatus:PpuStatus;
  //当前的精灵在RAM中的地址? 0x2003
  public oamAddress:number;
  //地址锁存器。通过锁存器来判断当前要写入高八位还是低八位了
  public addressLatch:boolean;
  //x的精准滚动偏移量
  public xFine:number
  //临时的dataAddress
  public tmpAddress:REGV;
  //x/y轴偏移量，使用的命名表id，y轴精准滚动值
  public dataAddress:REGV;
  public dataBuffer:number;


  // PPU

  public scanline:number; //第几条扫描线
  public cycle:number; //这条扫描线的第几个周期
  public scanlineSprDx:number;
  public scanlineSprCnt:number; //下一条扫描线上需要渲染的精灵个数
  public ppuBus:PpuBus; //CPU总线
  public oamram:OAMRAM; //精灵RAM
  public evenFrame:boolean; //是不是偶数像素
  public frameDx:number; //是不是偶数像素
  public frameFinished:number;
  //渲染数据
  public frameData:ArrayBuffer;

  constructor(){
    this.reset();
  }

  //重置/初始化
  public reset():void{
    this.regCtrl.setData(0);
    this.regMask.setData(0);
    this.regStatus.setData(0);
    this.addressLatch=true;
    this.xFine=0;
    this.tmpAddress.setData(0);
    this.dataAddress.setData(0);
    this.dataBuffer=0;
    this.scanline=-1;
    this.cycle=0;
    this.scanlineSprCnt=0;
    this.scanlineSprDx=8;
    this.frameDx=0;
    this.frameFinished=-1;
    //256*240实际渲染像素, 每个像素包括R,G,B,A值(nes本身没有A值,这里加上方便拓展)
    this.frameData=new ArrayBuffer(256*240*4);
    this.oamram=new OAMRAM();
    this.evenFrame=true;
  }

  //CPU调用的接口
  //写入PPU控制寄存器
  public writeCtrl(value:number):void{
    this.regCtrl.setData(value);
    //设置nametable的时候要修改tempAddress的内容
    this.tmpAddress.setNametable(value&0x3);
  }
  //写入PPU掩码寄存器
  public writeMask(value:number):void{
    this.regMask.setData(value);
  }

  //获取状态寄存器
  public getStatus():number{
    const data:number= this.regStatus.getData();
    this.regStatus.setVblank(false);
    this.addressLatch = true;
    return data;
  }
  //写入OAM精灵地址
  public writeOamaddr(value:number):void{
    this.oamAddress=value;
  }
  //写入精灵数据
  public writeOamdata(value:number):void{
    this.oamram.setData(this.oamAddress,value);
  }
  //获取OAM精灵数据
  public getOamdata():number{
    return this.oamram.getData(this.oamAddress);
  }
  //写入滚动数据
  public writeScroll(value:number):void{
    if (this.addressLatch){
      //输入值的高五位为x轴滚动，低三位为x轴的精细坐标
      this.tmpAddress.setXscroll((value >> 3) & 0x1f);
      this.xFine = value & 0x7;
      this.addressLatch = false;
    }else{
      this.tmpAddress.setYscroll((value >> 3) & 0x1f);
      this.tmpAddress.setYfine(value & 0x7);
      this.addressLatch = true;
    }
  }

  //写入地址
  public writeAddr(value:number):void{
    if (this.addressLatch){
      this.tmpAddress.setHi6(value & 0x3f);
      this.addressLatch = false;
    }else{
      this.tmpAddress.setLow8(value);
      this.dataAddress.setData(this.tmpAddress.getData());
      this.addressLatch = true;
    }
  }
  //写入数据
  public writeData(value:number):void{
    let address:number=this.dataAddress.getData();
    this.ppuBus.setValue(address,value);
    address=(address+this.regCtrl.getAddrincrement())&0xffff;
    this.dataAddress.setData(address);
  }
  //读取数据
  public readData():number{
    let address:number=this.dataAddress.getData();
    let dataRet:number=this.ppuBus.getValue(address);
    if (this.dataAddress.getData() < 0x3f00){
      const tmp:number=this.dataBuffer;
      this.dataBuffer = dataRet;
      dataRet = tmp;
    }else{
      this.dataBuffer=this.ppuBus.getValue(address);
    }
    address+= this.regCtrl.getAddrincrement();
    this.dataAddress.setData(address&0xffff);
    return dataRet;
  }

  //从DMA拷贝数据到精灵RAM
  public oamDma(pageView:DataView):void{
    //先拷贝到$2003之后的地址，再拷贝到0-$2003的地址 TODO
    const len:number=256-this.oamAddress;
    this.copyArrayBuffer(pageView,this.oamAddress,len);
    if(this.oamAddress){
      this.copyArrayBuffer(pageView,len,this.oamAddress);
    }
  }

  //拷贝ArrayBuffer数据
  public copyArrayBuffer(from:DataView,start:number,len:number):void{
    for(let i=0;i<len;i++){
      this.oamram.setData(start+i,from.getUint8(i));
    }
  }

  //主循环
  public step():void{
    console.log('进入主循环');
  }
}