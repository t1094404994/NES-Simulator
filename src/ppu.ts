import { Cpu } from './cpu';
import {Oamram, OAMSprite, PpuBus } from './ppuBus';

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
  public setNametableX(value:number):void{ 
    if (value) this.data |= 1 << 10;
    else this.data &= 0xfbff;
  }
  //设置NameTable_Y的数值
  public setNametableY(value:number):void{ 
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
  public getNametableX():number{
    if (this.data & (1 << 10)) return 1;
    else return 0;
  }
  public getNametableY():number{
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

  //扫描线在第几行
  public scanline:number;
  //这条扫描线的第几个周期
  public cycle:number; 
  public scanlineSprDx:ArrayBuffer;
  public scanlineSprDxView:DataView;
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
  //渲染数据
  private frameData:ArrayBuffer;
  public frameDataView:DataView;

  //调色板数据 [64][3] 没有A值
  private palette:Array<Array<number>>;

  private cpu:Cpu;

  constructor(){
    this.regCtrl=new PpuCtrl();
    this.regMask=new PpuMask();
    this.regStatus=new PpuStatus();
    this.tmpAddress=new REGV();
    this.dataAddress=new REGV();
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
    this.scanlineSprDx=new ArrayBuffer(8);
    this.scanlineSprDxView=new DataView(this.scanlineSprDx);
    this.frameDx=0;
    this.frameFinished=-1;
    //256*240实际渲染像素, 每个像素包括R,G,B,A值(nes本身没有A值,这里加上方便拓展)
    this.frameData=new ArrayBuffer(256*240*4);
    this.frameDataView=new DataView(this.frameData);
    this.oamram=new Oamram();
    this.evenFrame=true;
  }

  public setCpu(_cpu:Cpu):void{
    this.cpu=_cpu;
  }

  public setPpuBus(_ppuBus:PpuBus):void{
    this.ppuBus=_ppuBus;
  }

  //初始化调色板
  public initPalette():void{
    this.palette=[ 
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

  //PPU主循环
  public step():void{
    if (this.scanline === -1){
      // PreRender扫描线
      if (this.cycle === 1){
        this.regStatus.setVblank(false);
        this.regStatus.setSpr0hit(false);
        this.regStatus.setSproverflow(false);
      }
      if (this.cycle === 258 && this.regMask.getShowbkg() && this.regMask.getShowspr()){
        this.dataAddress.setXscroll(this.tmpAddress.getXscroll());
        this.dataAddress.setNametableX(this.tmpAddress.getNametableX());
      }
      if (this.cycle >= 280 && this.cycle <= 304 && this.regMask.getShowbkg() && this.regMask.getShowspr()){
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

        //这三个变量会用来确定颜色的优先级，背景的调色板id，精灵的调色板id，精灵是否在先
        let bkgcolorInPalette=0;
        let sprcolorInPalette=0;
        let sprBehindBackground = true;
        //背景地址,精灵地址
        let bkgPaletteAddress=0;
        let sprPaletteAddress=0;

        if (this.regMask.getShowbkg()){
          //根据偏移量，当前的x是tile中的第几个位置
          const xInTile = (x + this.xFine) % 8;
          const yInTile = this.dataAddress.getYfine();
          if (x >= 8 || this.regMask.getShowedgebkg()){
            //如果隐藏最左边八个像素的背景的话，那最左边八个像素的背景渲染就可以略掉
            //找出这个位置的命名表内容，找到对应的图案表的地址
            const nametableAddr:number = 0x2000 | (this.dataAddress.getData() & 0x0fff);
            const tileDx:number= this.ppuBus.getValue(nametableAddr);
            // 读取图案表，获取这个像素点的颜色代码
            //每一个tile占据16个字节。然后根据y的fine滚动数值，来确定这个像素来对应tile的那个位置（tile中每一行就是一个字节）
            let patterntableAddr:number = tileDx * 16 + yInTile;
            if (this.regCtrl.getBptableDx()){
              patterntableAddr += 0x1000;
              patterntableAddr&0xffff;
            }
            //TODO 可能有问题
            const lowBit:number= ((this.ppuBus.getValue(patterntableAddr) >> (7 - xInTile)) & 1);
            const hiBit:number= ((this.ppuBus.getValue(patterntableAddr + 8) >> (7 - xInTile)) & 1);
            bkgcolorInPalette = (hiBit << 1) + lowBit;
            // 读取属性表，得知这个像素点所在的tile对应的调色板id是什么
            const attribDx:number= ((this.dataAddress.getYscroll() >> 2) << 3) + ((this.dataAddress.getXscroll() >> 2) & 7);
            const attribAddress:number= 0x23c0 + (this.dataAddress.getNametableY() * 2 + this.dataAddress.getNametableX()) * 0x400 + attribDx;
            const attrDx:number= this.ppuBus.getValue(attribAddress);
            // y=16~32，x=16~32时，取attribute table的最高两位作为调色板索引。此时右移6位
            // y=16~32，x=0~15时，取attribute table的次高两位作为调色板索引。此时右移4位
            // y=0~15，x=16~32时，取attribute table的次低两位作为调色板索引。此时右移2位
            // y=0~15，x=0~15时，取attribute table的最低两位作为调色板索引。此时右移0位
            const attr_shift = ((this.dataAddress.getYscroll() & 2) << 1) + (this.dataAddress.getXscroll() & 2);
            const palette_dx = (attrDx >> attr_shift) & 3;

            bkgPaletteAddress = 0x3f00 + 4 * palette_dx + bkgcolorInPalette;
          }
          // 如果已经到达了一个tile的最后一个像素，则真实像素的下一格就应该是下一个tile的第一个像素了
          if (xInTile === 7){
            if (this.dataAddress.getXscroll() === 31){
              this.dataAddress.setXscroll(0);
              //当已经到达这个命名表横轴上的最后一个位置时，则切换到下一个Horizental命名表
              this.dataAddress.setNametableX(this.dataAddress.getNametableX()===0?1:0);
            }else{
              this.dataAddress.setXscroll(this.dataAddress.getXscroll() + 1);
            }
          }
        }
        if (this.regMask.getShowspr()){
          if (x >= 8 || this.regMask.getShowedgespr()){
            for (let sprIt=0; sprIt <= this.scanlineSprCnt - 1; sprIt++){
              const sprDx = this.scanlineSprDxView.getUint8(sprIt);
              let oamSprite:OAMSprite;
              //找出这个像素的的图案表的颜色代码
              if (this.regCtrl.getSpriteSize()){
                //渲染8*16的精灵
                oamSprite = this.oamram.getOneSpriteLong(sprDx);
                if (x - oamSprite.locX < 0 || x - oamSprite.locX >= 8)
                //TODO
                  continue;
                let xInTile = (x - oamSprite.locX)&0xff;
                //在第二个scanline，渲染的其实是第一个scanline中应该渲染的精灵，所以y轴的数值要减一
                let yInTile = (y - 1 - oamSprite.locY)&0xff;
                if(oamSprite.flipX) //x轴翻转
                  xInTile = (7 - xInTile)&0xff;
                if (oamSprite.flipY) //y轴翻转
                  yInTile = (15 - yInTile)&0xff;
                //对于8*16的sprite，tile占据32个字节。然后根据y轴的数值，来确定这个像素来对应tile的那个位置（tile中每一行就是一个字节）
                let patterntableAddr;
                if (yInTile >= 8)
                  patterntableAddr = oamSprite.patterntableAddress + 16 + (yInTile & 0x7);
                else
                  patterntableAddr = oamSprite.patterntableAddress + (yInTile & 0x7);
                const lowBit:number= ((this.ppuBus.getValue(patterntableAddr) >> (xInTile)) & 1);
                const hiBit:number= ((this.ppuBus.getValue(patterntableAddr + 8) >> (xInTile)) & 1);
                sprcolorInPalette =(hiBit << 1) + lowBit;
              }else{
                //渲染8*8的精灵
                oamSprite = this.oamram.getOneSprite(sprDx);
                if (x - oamSprite.locX < 0 || x - oamSprite.locY >= 8)
                  continue;
                //找出这个像素的的图案表的颜色代码
                let xInTile = (x - oamSprite.locX)&0xff;
                let yInTile = (y - 1 - oamSprite.locY)&0xff; //Tips: 在第二个scanline，渲染的其实是第一个scanline中应该渲染的精灵，所以y轴的数值要减一
                if(oamSprite.flipX) //x轴翻转
                  xInTile = 7 - xInTile;
                if (oamSprite.flipY) //y轴翻转
                  yInTile = 7 - yInTile;
                //对于8*8的sprite，tile占据16个字节。然后根据y轴的数值，来确定这个像素来对应tile的那个位置（tile中每一行就是一个字节）
                let patterntableAddress = oamSprite.patterntableAddress + (yInTile & 0x7);
                if (this.regCtrl.getSptableDx()){
                  patterntableAddress += 0x1000;
                  patterntableAddress&0xffff;
                }
                const lowBit:number= ((this.ppuBus.getValue(patterntableAddress) >> (xInTile)) & 1);
                const hiBit:number= ((this.ppuBus.getValue(patterntableAddress + 8) >> (xInTile)) & 1);
                sprcolorInPalette =(hiBit << 1) + lowBit;
              }
              //根据颜色代码来获取颜色。如果颜色代码为0的话，则这个像素不使用这个精灵的颜色，否则使用这个精灵的颜色
              if (sprcolorInPalette === 0)
                continue;
              sprPaletteAddress = 0x3f10 + 4 * oamSprite.paletteDx + sprcolorInPalette;
              sprBehindBackground = oamSprite.behindBackground;
              //sprite 0 hit的触发条件是，当数值不为零的0号sprite与数值不为零的background在同一像素出现
              if (!this.regStatus.getSpr0hit() && this.regMask.getShowbkg() && sprDx === 0 && bkgcolorInPalette !== 0){
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
        const point:number=(x+(y*256))*4;
        this.frameDataView.setUint8(point,this.palette[this.ppuBus.getValue(paletteAdd) & 0x3f][0]);
        this.frameDataView.setUint8(point+1,this.palette[this.ppuBus.getValue(paletteAdd) & 0x3f][1]);
        this.frameDataView.setUint8(point+2,this.palette[this.ppuBus.getValue(paletteAdd) & 0x3f][2]);
        this.frameDataView.setUint8(point+3,255);
        console.log('设置一个点');
      }
      if (this.cycle === 257 && this.regMask.getShowbkg()){
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
      if (this.cycle === 258 && this.regMask.getShowbkg() && this.regMask.getShowspr()){
        this.dataAddress.setXscroll(this.tmpAddress.getXscroll());
        this.dataAddress.setNametableX(this.tmpAddress.getNametableX());
      }
      if (this.cycle === 340){
        //获取下一条扫描线上需要渲染哪些精灵
        //先初始化下一条扫描线上需要渲染的精灵列表
        this.scanlineSprCnt = 0;
        let sprOverflow = false;
        //再获取这一条扫描线上需要获取的精灵列表，按照优先级排列前八个精灵。如果超过八个，则置sprite overflow为true
        const sprLength = this.regCtrl.getSpriteSize() ? 16 : 8;
        for (let sprIt= 0; sprIt <= 63; sprIt++){
          if (this.oamram.getData(sprIt * 4) > this.scanline - sprLength && this.oamram.getData(sprIt * 4) <= this.scanline){
            if (this.scanlineSprCnt === 8){
              //qDebug() << "Sprite overflow, frame_dx = " << frame_dx << ", scanline = " << scanline << ", sprIt = " << sprIt << endl;
              sprOverflow = true;
              break;
            }else{
              this.scanlineSprDxView.setUint8(this.scanlineSprCnt,sprIt);
              this.scanlineSprCnt++;
            }
          }
        }
        this.regStatus.setSproverflow(sprOverflow);
      }
    }
    //一帧画面256x240的渲染完成
    if (this.scanline === 240 && this.cycle === 0){
      this.frameFinished++;
    }
    //垂直消隐阶段
    if (this.scanline >= 241){
      if (this.scanline === 241 && this.cycle === 1)
      {
        //进入垂直消隐阶段时，调用CPU的NMI中断
        this.regStatus.setVblank(true);
        if (this.regCtrl.getNmi())
          this.cpu.nmi();
      }
    }
    //scanline和cycle递增
    if (this.scanline === -1 && this.cycle >= 340 - (!this.evenFrame && this.regMask.getShowbkg() && this.regMask.getShowspr())){
      // 渲染奇数像素时，会把第-1条扫描线的第340个周期直接过掉
      this.cycle = 0;
      this.scanline = 0;
    }else{
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
}