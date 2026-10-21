import { Cpu } from './cpu';
import {Oamram, PpuBus } from './ppuBus';

//PPU控制寄存器 CPU总线的0x2000
export class PpuCtrl{
  private data:number;
  public bgTable=0;
  public spTable=0;
  public sprite16=0;
  public nmi=0;
  public addrInc=1;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.setData(0);
  }
  public setData(value:number):void{
    this.data=value;
    this.bgTable=(value&(1<<4))?1:0;
    this.spTable=(value&(1<<3))?1:0;
    this.sprite16=(value&(1<<5))?1:0;
    this.nmi=(value&(1<<7))?1:0;
    this.addrInc=(value&(1<<2))?32:1;
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
  public showBg=0;
  public showSpr=0;
  public edgeBg=0;
  public edgeSpr=0;
  public rendering=false;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.setData(0);
  }
  public setData(value:number):void{
    this.data=value;
    this.edgeBg=(value&0x02)?1:0;
    this.edgeSpr=(value&0x04)?1:0;
    this.showBg=(value&0x08)?1:0;
    this.showSpr=(value&0x10)?1:0;
    this.rendering=(value&0x18)!==0;
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
  /** Nesdev：背景或精灵任一开启即为 rendering enabled */
  public isRenderingEnabled():boolean{
    return this.rendering;
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
  public xScroll=0;
  public yScroll=0;
  public yFine=0;
  public ntX=0;
  public ntY=0;
  constructor(){
    this.reset();
  }
  public reset():void{
    this.setData(0);
  }
  public setData(value:number):void{
    this.data=value;
    this.sync();
  }
  public getData():number{
    return this.data;
  }

  private sync():void{
    const data=this.data;
    this.xScroll=data&0x1f;
    this.yScroll=(data&0x3e0)>>5;
    this.yFine=(data&0x7000)>>12;
    this.ntX=(data&0x400)?1:0;
    this.ntY=(data&0x800)?1:0;
  }

  //设置寄存器的低八位值
  public setLow8(value:number):void{
    this.data &= 0xff00;
    this.data |= value;
    this.sync();
  }
  //设置寄存器的9-14位值. 更高的数值会被映射下去
  public setHi6(value:number):void{ 
    this.data &= 0x00ff;
    this.data |= ((value & 0x3f) << 8);
    this.sync();
  }
  //设置NameTable的数值
  public setNametable(value:number):void{ 
    this.data &= 0xf3ff;
    this.data |= ((value & 0x3) << 10);
    this.sync();
  }
  //设置NameTable_X的数值
  public setNametableX(value:number):void{ 
    if (value) this.data |= 1 << 10;
    else this.data &= 0xfbff;
    this.sync();
  }
  //设置NameTable_Y的数值
  public setNametableY(value:number):void{ 
    if (value) this.data |= 1 << 11;
    else this.data &= 0xf7ff;
    this.sync();
  }
  //设置x_scroll的数值
  public setXscroll(value:number):void{ 
    this.data &= 0xffe0;
    this.data |= (value & 0x1f);
    this.sync();
  }
  //设置y_scroll的数值
  public setYscroll(value:number):void{ 
    this.data &= 0xfc1f;
    this.data |= ((value & 0x1f) << 5);
    this.sync();
  }
  //设置y_fine的数值
  public setYfine(value:number):void{
    this.data &= 0x8fff;
    this.data |= ((value & 0x7) << 12);
    this.sync();
  }
  //获取x_scroll的数值
  public getXscroll():number{ 
    return this.xScroll;
  }
  public getNametableX():number{
    return this.ntX;
  }
  public getNametableY():number{
    return this.ntY;
  }
  //获取y_scroll的数值
  public getYscroll():number{ 
    return this.yScroll;
  }
  //获取y_fine的数值
  public getYfine():number{ 
    return this.yFine;
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

  //扫描线在第几行
  public scanline:number;
  //这条扫描线的第几个周期
  public cycle:number; 
  public scanlineSprDx:Uint8Array;
  //下一条扫描线上需要渲染的精灵个数
  public scanlineSprCnt:number;
  //CPU总线
  public ppuBus:PpuBus;
  //精灵RAM
  public oamram:Oamram;
  //是不是偶数像素
  public evenFrame:boolean; 
  public frameDx:number;
  //该帧
  public frameFinished:number;
  //渲染数据。构造后不再更换缓冲，宿主可直接查看。
  public readonly frameData:ArrayBuffer;
  public readonly frameBytes:Uint8Array;
  public readonly frameWords:Uint32Array;

  //调色板，小端 R | G<<8 | B<<16 | A<<24
  private paletteRgba:Uint32Array;
  private suppressVblank:boolean;
  private nmiDelayDots:number;
  /** $2000/$2001/$2005/$2006 以及 OAM 之外的渲染状态变化。 */
  private renderEpoch=0;
  private oamEpoch=0;
  private bgValid=false;
  private bgY=-2;
  private bgRenderEpoch=-1;
  private bgVramEpoch=-1;
  private bgLo=0;
  private bgHi=0;
  private bgPal=0;
  private sprX=new Uint8Array(8);
  private sprAttr=new Uint8Array(8);
  private sprLo=new Uint8Array(8);
  private sprHi=new Uint8Array(8);
  private sprLine=-2;
  private sprRenderEpoch=-1;
  private sprVramEpoch=-1;
  private sprOamEpoch=-1;

  private cpu:Cpu;

  constructor(){
    this.regCtrl=new PpuCtrl();
    this.regMask=new PpuMask();
    this.regStatus=new PpuStatus();
    this.tmpAddress=new REGV();
    this.dataAddress=new REGV();
    this.frameData=new ArrayBuffer(256*240*4);
    this.frameBytes=new Uint8Array(this.frameData);
    this.frameWords=new Uint32Array(this.frameData);
    this.scanlineSprDx=new Uint8Array(8);
    this.oamram=new Oamram();
    this.paletteRgba=new Uint32Array(64);
    this.initPalette();
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
    this.scanlineSprDx.fill(0);
    this.frameDx=0;
    this.frameFinished=-1;
    this.suppressVblank=false;
    this.nmiDelayDots=0;
    this.oamAddress=0;
    this.frameWords.fill(0);
    this.oamram.reset();
    this.evenFrame=true;
    this.bgValid=false;
    this.bgY=-2;
    this.sprLine=-2;
    this.renderEpoch++;
    this.oamEpoch++;
  }

  public setCpu(_cpu:Cpu):void{
    this.cpu=_cpu;
  }

  public setPpuBus(_ppuBus:PpuBus):void{
    this.ppuBus=_ppuBus;
  }

  //初始化调色板
  public initPalette():void{
    const rgb:number[][]=[ 
      [0x1D<<2, 0x1D<<2, 0x1D<<2], /* Value 0 */
      [0x09<<2, 0x06<<2, 0x23<<2], /* Value 1 */
      [0x00<<2, 0x00<<2, 0x2A<<2], /* Value 2 */
      [0x11<<2, 0x00<<2, 0x27<<2], /* Value 3 */
      [0x23<<2, 0x00<<2, 0x1D<<2], /* Value 4 */
      [0x2A<<2, 0x00<<2, 0x04<<2], /* Value 5 */
      [0x29<<2, 0x00<<2, 0x00<<2], /* Value 6 */
      [0x1F<<2, 0x02<<2, 0x00<<2], /* Value 7 */
      [0x10<<2, 0x0B<<2, 0x00<<2], /* Value 8 */
      [0x00<<2, 0x11<<2, 0x00<<2], /* Value 9 */
      [0x00<<2, 0x14<<2, 0x00<<2], /* Value 10 */
      [0x00<<2, 0x0F<<2, 0x05<<2], /* Value 11 */
      [0x06<<2, 0x0F<<2, 0x17<<2], /* Value 12 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 13 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 14 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 15 */
      [0x2F<<2, 0x2F<<2, 0x2F<<2], /* Value 16 */
      [0x00<<2, 0x1C<<2, 0x3B<<2], /* Value 17 */
      [0x08<<2, 0x0E<<2, 0x3B<<2], /* Value 18 */
      [0x20<<2, 0x00<<2, 0x3C<<2], /* Value 19 */
      [0x2F<<2, 0x00<<2, 0x2F<<2], /* Value 20 */
      [0x39<<2, 0x00<<2, 0x16<<2], /* Value 21 */
      [0x36<<2, 0x0A<<2, 0x00<<2], /* Value 22 */
      [0x32<<2, 0x13<<2, 0x03<<2], /* Value 23 */
      [0x22<<2, 0x1C<<2, 0x00<<2], /* Value 24 */
      [0x00<<2, 0x25<<2, 0x00<<2], /* Value 25 */
      [0x00<<2, 0x2A<<2, 0x00<<2], /* Value 26 */
      [0x00<<2, 0x24<<2, 0x0E<<2], /* Value 27 */
      [0x00<<2, 0x20<<2, 0x22<<2], /* Value 28 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 29 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 30 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 31 */
      [0x3F<<2, 0x3F<<2, 0x3F<<2], /* Value 32 */
      [0x0F<<2, 0x2F<<2, 0x3F<<2], /* Value 33 */
      [0x17<<2, 0x25<<2, 0x3F<<2], /* Value 34 */
      [0x33<<2, 0x22<<2, 0x3F<<2], /* Value 35 */
      [0x3D<<2, 0x1E<<2, 0x3F<<2], /* Value 36 */
      [0x3F<<2, 0x1D<<2, 0x2D<<2], /* Value 37 */
      [0x3F<<2, 0x1D<<2, 0x18<<2], /* Value 38 */
      [0x3F<<2, 0x26<<2, 0x0E<<2], /* Value 39 */
      [0x3C<<2, 0x2F<<2, 0x0F<<2], /* Value 40 */
      [0x20<<2, 0x34<<2, 0x04<<2], /* Value 41 */
      [0x13<<2, 0x37<<2, 0x12<<2], /* Value 42 */
      [0x16<<2, 0x3E<<2, 0x26<<2], /* Value 43 */
      [0x00<<2, 0x3A<<2, 0x36<<2], /* Value 44 */
      [0x1E<<2, 0x1E<<2, 0x1E<<2], /* Value 45 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 46 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 47 */
      [0x3F<<2, 0x3F<<2, 0x3F<<2], /* Value 48 */
      [0x2A<<2, 0x39<<2, 0x3F<<2], /* Value 49 */
      [0x31<<2, 0x35<<2, 0x3F<<2], /* Value 50 */
      [0x35<<2, 0x32<<2, 0x3F<<2], /* Value 51 */
      [0x3F<<2, 0x31<<2, 0x3F<<2], /* Value 52 */
      [0x3F<<2, 0x31<<2, 0x36<<2], /* Value 53 */
      [0x3F<<2, 0x2F<<2, 0x2C<<2], /* Value 54 */
      [0x3F<<2, 0x36<<2, 0x2A<<2], /* Value 55 */
      [0x3F<<2, 0x39<<2, 0x28<<2], /* Value 56 */
      [0x38<<2, 0x3F<<2, 0x28<<2], /* Value 57 */
      [0x2A<<2, 0x3C<<2, 0x2F<<2], /* Value 58 */
      [0x2C<<2, 0x3F<<2, 0x33<<2], /* Value 59 */
      [0x27<<2, 0x3F<<2, 0x3C<<2], /* Value 60 */
      [0x31<<2, 0x31<<2, 0x31<<2], /* Value 61 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 62 */
      [0x00<<2, 0x00<<2, 0x00<<2], /* Value 63 */
    ];
    for(let i=0;i<64;i++){
      const r=rgb[i][0];
      const g=rgb[i][1];
      const b=rgb[i][2];
      this.paletteRgba[i]=(r|(g<<8)|(b<<16)|(255<<24))>>>0;
    }
  }

  //CPU调用的接口
  //写入PPU控制寄存器
  public writeCtrl(value:number):void{
    const wasNmiEnabled=!!this.regCtrl.getNmi();
    this.regCtrl.setData(value);
    if(!this.regCtrl.getNmi()){
      this.nmiDelayDots=0;
    }else if(!wasNmiEnabled&&this.regStatus.getVblank()){
      // 与预渲染行清 VBL 同一点打开 NMI 时，/NMI 来不及形成下降沿
      if(!(this.scanline===-1&&this.cycle===1)){
        this.cpu.requestNmi(1);
      }
    }
    //设置nametable的时候要修改tempAddress的内容
    this.tmpAddress.setNametable(value&0x3);
    this.renderEpoch++;
  }
  //写入PPU掩码寄存器
  public writeMask(value:number):void{
    this.regMask.setData(value);
    this.renderEpoch++;
  }

  //获取状态寄存器
  public getStatus():number{
    const data:number= this.regStatus.getData();
    if(this.scanline===241&&this.cycle===1){
      this.suppressVblank=true;
    }
    // 置位当拍或下一拍读到 V，但 NMI 还没送到 CPU，读 $2002 会把它掐掉
    if(this.nmiDelayDots>0){
      this.nmiDelayDots=0;
    }
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
    this.oamAddress=(this.oamAddress+1)&0xff;
    this.oamEpoch++;
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
    this.renderEpoch++;
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
    this.renderEpoch++;
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

  //从DMA拷贝数据到精灵RAM（从 OAMADDR 起环形写入 256 字节）
  public oamDma(page:Uint8Array):void{
    const bytes=this.oamram.bytes;
    let addr=this.oamAddress;
    for(let i=0;i<256;i++){
      bytes[addr]=page[i];
      addr=(addr+1)&0xff;
    }
    this.oamEpoch++;
  }

  public runDots(count:number):void{
    for(let i=0;i<count;i++) this.step();
  }

  private fetchBackground():void{
    const addr=this.dataAddress;
    const yInTile=addr.yFine;
    const nametableAddr=0x2000|(addr.getData()&0x0fff);
    const tileDx=this.ppuBus.getValue(nametableAddr);
    let patterntableAddr=tileDx*16+yInTile;
    if(this.regCtrl.bgTable) patterntableAddr+=0x1000;
    this.bgLo=this.ppuBus.getValue(patterntableAddr);
    this.bgHi=this.ppuBus.getValue(patterntableAddr+8);
    const attribDx=((addr.yScroll>>2)<<3)+((addr.xScroll>>2)&7);
    const attribAddress=0x23c0+(addr.ntY*2+addr.ntX)*0x400+attribDx;
    const attrDx=this.ppuBus.getValue(attribAddress);
    const attrShift=((addr.yScroll&2)<<1)+(addr.xScroll&2);
    this.bgPal=(attrDx>>attrShift)&3;
  }

  private refreshLineSprites(y:number):void{
    const oam=this.oamram.bytes;
    const cnt=this.scanlineSprCnt;
    const tall=this.regCtrl.sprite16;
    const spTable=this.regCtrl.spTable;
    const bus=this.ppuBus;
    for(let i=0;i<cnt;i++){
      const offset=this.scanlineSprDx[i]<<2;
      const locY=oam[offset];
      const tile=oam[offset+1];
      const attr=oam[offset+2];
      this.sprX[i]=oam[offset+3];
      this.sprAttr[i]=attr;
      const flipY=(attr&0x80)!==0;
      let patterntableAddr:number;
      if(tall){
        let yInTile=(y-1-locY)&0xff;
        const bank=(tile&1)*0x1000;
        const topTile=tile&0xfe;
        const base=(bank+topTile*16)&0xffff;
        if(flipY) yInTile=(15-yInTile)&0xff;
        if(yInTile>=8) patterntableAddr=base+16+(yInTile&7);
        else patterntableAddr=base+(yInTile&7);
      }else{
        let yInTile=(y-1-locY)&0xff;
        if(flipY) yInTile=7-yInTile;
        patterntableAddr=tile*16+(yInTile&7);
        if(spTable) patterntableAddr+=0x1000;
      }
      this.sprLo[i]=bus.getValue(patterntableAddr);
      this.sprHi[i]=bus.getValue(patterntableAddr+8);
    }
    this.sprLine=y;
    this.sprRenderEpoch=this.renderEpoch;
    this.sprVramEpoch=bus.vramEpoch;
    this.sprOamEpoch=this.oamEpoch;
  }

  //PPU主循环
  public step():void{
    if(this.nmiDelayDots>0){
      this.nmiDelayDots--;
      if(this.nmiDelayDots===0&&this.regCtrl.getNmi()){
        this.cpu.requestNmi(2);
      }
    }
    if (this.scanline === -1){
      // PreRender扫描线
      if (this.cycle === 1){
        this.regStatus.setVblank(false);
        this.regStatus.setSpr0hit(false);
        this.regStatus.setSproverflow(false);
      }
      if (this.cycle === 258 && this.regMask.isRenderingEnabled()){
        this.dataAddress.setXscroll(this.tmpAddress.getXscroll());
        this.dataAddress.setNametableX(this.tmpAddress.getNametableX());
      }
      if (this.cycle >= 280 && this.cycle <= 304 && this.regMask.isRenderingEnabled()){
        this.dataAddress.setYscroll(this.tmpAddress.getYscroll());
        this.dataAddress.setNametableY(this.tmpAddress.getNametableY());
        this.dataAddress.setYfine(this.tmpAddress.getYfine());
      }
    }
    //逐行渲染阶段
    if (this.scanline >= 0 && this.scanline < 240){
      if (this.cycle > 0 && this.cycle <= 256){
        //实际图像中的x和y
        const x:number= this.cycle - 1;
        const y:number= this.scanline;

        const mask=this.regMask;
        //这三个变量会用来确定颜色的优先级，背景的调色板id，精灵的调色板id，精灵是否在先
        let bkgcolorInPalette=0;
        let sprcolorInPalette=0;
        let sprBehindBackground = true;
        //背景调色版地址,精灵调色板地址
        let bkgPaletteAddress=0;
        let sprPaletteAddress=0;

        if (mask.showBg){
          //根据偏移量，当前的x是tile中的第几个位置
          const xInTile = (x + this.xFine) % 8;
          const vramEpoch=this.ppuBus.vramEpoch;
          if (x >= 8 || mask.edgeBg){
            if(
              xInTile===0||
              !this.bgValid||
              this.bgY!==y||
              this.bgRenderEpoch!==this.renderEpoch||
              this.bgVramEpoch!==vramEpoch
            ){
              this.fetchBackground();
              this.bgValid=true;
              this.bgY=y;
              this.bgRenderEpoch=this.renderEpoch;
              this.bgVramEpoch=vramEpoch;
            }
            const shift=7-xInTile;
            bkgcolorInPalette=((this.bgHi>>shift)&1)<<1|((this.bgLo>>shift)&1);
            bkgPaletteAddress=0x3f00+(this.bgPal<<2)+bkgcolorInPalette;
          }else if(xInTile===0){
            this.bgValid=false;
          }
          // 如果已经到达了一个tile的最后一个像素，则真实像素的下一格就应该是下一个tile的第一个像素了
          if (xInTile === 7){
            const addr=this.dataAddress;
            if (addr.xScroll === 31){
              addr.setXscroll(0);
              //当已经到达这个命名表横轴上的最后一个位置时，则切换到下一个Horizental命名表
              addr.setNametableX(addr.ntX===0?1:0);
            }else{
              addr.setXscroll(addr.xScroll + 1);
            }
          }
        }
        if (mask.showSpr){
          if (x >= 8 || mask.edgeSpr){
            const vramEpoch=this.ppuBus.vramEpoch;
            if(
              this.sprLine!==y||
              this.sprRenderEpoch!==this.renderEpoch||
              this.sprVramEpoch!==vramEpoch||
              this.sprOamEpoch!==this.oamEpoch
            ){
              this.refreshLineSprites(y);
            }
            const cnt=this.scanlineSprCnt;
            for (let sprIt=0; sprIt < cnt; sprIt++){
              const locX=this.sprX[sprIt];
              if (x - locX < 0 || x - locX >= 8)
                continue;
              let xInTile = (x - locX)&0xff;
              const attr=this.sprAttr[sprIt];
              if(attr&0x40)
                xInTile = (7 - xInTile)&0xff;
              const shift=7-xInTile;
              sprcolorInPalette=(((this.sprHi[sprIt]>>shift)&1)<<1)|((this.sprLo[sprIt]>>shift)&1);
              //根据颜色代码来获取颜色。如果颜色代码为0的话，则这个像素不使用这个精灵的颜色，否则使用这个精灵的颜色
              if (sprcolorInPalette === 0)
                continue;
              sprPaletteAddress = 0x3f10 + ((attr&3)<<2) + sprcolorInPalette;
              sprBehindBackground = (attr&0x20)!==0;
              //sprite 0 hit的触发条件是，当数值不为零的0号sprite与数值不为零的background在同一像素出现
              if (!this.regStatus.getSpr0hit() && mask.showBg && this.scanlineSprDx[sprIt] === 0 && bkgcolorInPalette !== 0){
                this.regStatus.setSpr0hit(true);
              }
              break;
            }
          }
        }
        //根据背景色和精灵色，综合确定这个像素的颜色是什么
        let paletteAdd:number;
        if (bkgcolorInPalette === 0 && sprcolorInPalette === 0)
          paletteAdd = 0x3f00;
        else if (bkgcolorInPalette !== 0 && sprcolorInPalette === 0)
          paletteAdd = bkgPaletteAddress;
        else if (bkgcolorInPalette === 0 && sprcolorInPalette !== 0)
          paletteAdd = sprPaletteAddress;
        else{
          if (sprBehindBackground)
            paletteAdd = bkgPaletteAddress;
          else
            paletteAdd = sprPaletteAddress;
        }
        this.frameWords[(y<<8)+x]=this.paletteRgba[this.ppuBus.getValue(paletteAdd)&0x3f];
      }
      if (this.cycle === 257 && this.regMask.isRenderingEnabled()){
        const yInTile:number = this.dataAddress.getYfine();
        if (yInTile === 7){
          this.dataAddress.setYfine(0);
          if (this.dataAddress.getYscroll() === 29){
            this.dataAddress.setYscroll(0);
            this.dataAddress.setNametableY(this.dataAddress.getNametableY()===0?1:0);
          }else if (this.dataAddress.getYscroll() === 31){
            //如果y超出了边界（30），例如把属性表中的数据当做tile读取的情况，则y到底后直接置为0，不切换命名表
            this.dataAddress.setYscroll(0);
          }else{
            this.dataAddress.setYscroll(this.dataAddress.getYscroll() + 1);
          }
        }else{
          this.dataAddress.setYfine(yInTile + 1);
        }
      }
      if (this.cycle === 258 && this.regMask.isRenderingEnabled()){
        this.dataAddress.setXscroll(this.tmpAddress.getXscroll());
        this.dataAddress.setNametableX(this.tmpAddress.getNametableX());
      }
      if (this.cycle === 340){
        //获取下一条扫描线上需要渲染哪些精灵
        //先初始化下一条扫描线上需要渲染的精灵列表
        this.scanlineSprCnt = 0;
        let sprOverflow = false;
        //再获取这一条扫描线上需要获取的精灵列表，按照优先级排列前八个精灵。如果超过八个，则置sprite overflow为true
        const sprLength = this.regCtrl.sprite16 ? 16 : 8;
        const oam=this.oamram.bytes;
        for (let sprIt= 0; sprIt <= 63; sprIt++){
          const sprY=oam[sprIt * 4];
          if (sprY > this.scanline - sprLength && sprY <= this.scanline){
            if (this.scanlineSprCnt === 8){
              sprOverflow = true;
              break;
            }else{
              this.scanlineSprDx[this.scanlineSprCnt]=sprIt;
              this.scanlineSprCnt++;
            }
          }
        }
        this.regStatus.setSproverflow(sprOverflow);
      }
    }
    // MMC3：仅在渲染开启时时钟 IRQ（关闭渲染时 PPU 不产生 A12 上升沿）
    if (
      this.cycle === 260 &&
      this.scanline >= -1 &&
      this.scanline <= 239 &&
      this.regMask.isRenderingEnabled()
    ){
      this.ppuBus.clockMapperIrq();
    }
    //一帧画面256x240的渲染完成
    if (this.scanline === 240 && this.cycle === 0){
      this.frameFinished++;
    }
    //垂直消隐阶段
    if (this.scanline >= 241){
      if (this.scanline === 241 && this.cycle === 1)
      {
        //进入垂直消隐：挂起 NMI，由 CPU 在指令边界采样
        if(this.suppressVblank){
          this.suppressVblank=false;
        }else{
          this.regStatus.setVblank(true);
          if (this.regCtrl.getNmi())
            this.nmiDelayDots=2;
        }
      }
    }
    // 奇数帧在预渲染 dot 338 结束时少走一拍。此时已能看见 dot 338 的 $2001，但还看不见 dot 339 的写入
    if(this.scanline===-1&&this.cycle===338&&!this.evenFrame&&this.regMask.isRenderingEnabled()){
      this.cycle++;
    }
    //scanline和cycle递增
    this.cycle++;
    if (this.cycle === 341){
      this.cycle = 0;
      this.scanline++;
      if (this.scanline >= 261){
        this.evenFrame = !this.evenFrame;
        this.scanline = -1;
        this.frameDx++;
      }
    }
  }
}