//声音处理

import { CpuBus } from './cpuBus';

//长度计数器
const LengthCounterMap:Array<number>=[
  0x0A, 0xFE, 0x14, 0x02,
  0x28, 0x04, 0x50, 0x06,
  0xA0, 0x08, 0x3C, 0x0A,
  0x0E, 0x0C, 0x1A, 0x0E,
  0x0C, 0x10, 0x18, 0x12,
  0x30, 0x14, 0x60, 0x16,
  0xC0, 0x18, 0x48, 0x1A,
  0x10, 0x1C, 0x20, 0x1E,
];

const SquareWaveMap:Array<Array<boolean>> =[
  [false,true,false, false,false, false, false, false],
  [false,true,true, false, false, false, false, false],
  [false,true,true, true, true, false, false, false],
  [true, false, false, true, true, true, true, true]
];

const TriangleWaveMap:Array<number> = [
  15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
];

const NoisePeriodMap:Array<number> = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
const DPCMPeriodMap:Array<number>= [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54];

//44.1k hz
const SAMPLE_PER_SEC=44100;
//CPU频率
const CPU_CYCLE_PER_SEC=1789773;
//一次需要的采样数
const SAMPLE_PER_CLOCK=(SAMPLE_PER_SEC / 240 + 1);

//方波寄存器
class SquareRegister{
  //4字节数据
  private data:Array<number>;
  constructor(){
    this.data=[];
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
  }

  public setData(index:number,value:number):void{
    this.data[index]=value;
  }

  //获取方波的占空比信息byte0 bit6,bit7
  public getDuty():number{
    return this.data[0]>>6;
  }

  //获取是否持续播放byte0 bit5
  public getHalt():boolean{
    return (this.data[0]>>5&1)===1;
  }

  //获取是否使用固定音量,否则使用包络音量 byte0  bit4 
  public getEnvelope():boolean{
    return (this.data[0]>>4&1)===1;
  }

  //获取音量byte0 bit0,1,2,3
  public getVolume():number{
    return this.data[0]&0xf;
  }

  //获取是否滑音byte1 bit7
  public getSweep():boolean{
    return (this.data[1]>>7)===1;
  }

  //获取滑音周期byte1 bit3,4,5
  public getSweepPeriod():number{
    return this.data[1]>>4&0x7;
  }

  //获取滑音的分频器数值
  public getSweepNeate():boolean{
    return (this.data[1]>>3&1)===1;
  }

  //获取滑音的分频改变值
  public getSweepShift():number{
    return this.data[1]&0x7;
  }

  //获取分频值
  public getPeriod():number{
    return this.data[2]|((this.data[3]&0x7)<<8);
  }

  //获取长度计数器值
  public getLenCounter():number{
    return LengthCounterMap[this.data[3]>>3];
  }
}

//三角波寄存器
class TriangularRegister{
    private data:Array<number>
    constructor(){
      this.data=[];
      this.data.push(0);
      this.data.push(0);
      this.data.push(0);
      this.data.push(0);
    }
    public setData(index:number,value:number):void{
      this.data[index]=value;
    }
    //获取三角波是否持续播放
    public getHalt():boolean{
      return (this.data[0]>>7&1)===1;
    }

    //获取线性计数器的初始值
    public getlineCounter():number{
      return this.data[0]&0x7f;
    }

    //获取分频数值
    public getPeriod():number{
      return this.data[2]|((this.data[3]&0x7)<<8);
    }

    //获取长度计数器的初始值
    public getLencounter():number{
      return LengthCounterMap[this.data[3]>>3];
    }
}

//噪声寄存器
class NoiseRegister{
  private data:Array<number>;
  constructor(){
    this.data=[];
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
  }

  public setData(index:number,value:number):void{
    this.data[index]=value;
  }

  //获取是否会一直播放
  public getHalt():boolean{
    return (this.data[0]>>5&1)===1;
  }

  //获取是否使用包络音量
  public getEnvelope():boolean{
    return (this.data[0]>>4&1)===1;
  }

  //获取音量
  public getVolume():number{
    return this.data[0]&0xf;
  }

  //获取噪音模式 1:短 0:长
  public getNoiseMode():boolean{
    return (this.data[2]>>7)===1;
  } 

  //获取采样周期
  public getNoisePeriod():number{
    return NoisePeriodMap[(this.data[2]&0xf)];
  }

  //获取长度计数器的初始值
  public getLenCounter():number{
    return LengthCounterMap[this.data[3]>>3];
  }
}

//DPCM 波形采样寄存器
class DPCMRegister{
  private data:Array<number>;
  constructor(){
    this.data=[];
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
  }
  
  //写入数据
  public setData(index:number,value:number):void{
    this.data[index]=value;
  }

  //播放完成之后是否产生IRQ中断
  public getIRQ():boolean{
    return (this.data[0]>>7&1)===1;
  }

  //是否循环播放
  public getLoop():boolean{
    return (this.data[0]>>6&1)===1;
  }

  //采样周期
  public getPeriod():number{
    return DPCMPeriodMap[this.data[0]&0xf];
  }

  //获取音量
  public getVolume():number{
    return this.data[1]&0x7f;
  }

  //获取样本的地址
  public getSampleAddress():number{
    return 0xc000|this.data[2]<<6;
  }

  //获取样本的长度
  public getSampleLen():number{
    return 1|this.data[3]<<4;
  }
}

//APU状态寄存器
class ApuStatusRegister{
  private data:number;
  constructor(){
    this.data=0;
  }

  public setData(value:number):number{
    return this.data=value;
  }

  public getDMC():boolean{
    return (this.data>>4&1)===1;
  }

  public getNoise():boolean{
    return (this.data>>3&1)===1;
  }

  public getTriangle():boolean{
    return (this.data>>2&1)===1;
  }

  public getPulse1():boolean{
    return (this.data>>1&1)===1;
  }

  public getPulse0():boolean{
    return (this.data&1)===1;
  }
}

//
class FrameCounter{
  private data:number;
  constructor(){
    this.data=0;
  }

  public setData(value:number):void{
    this.data=value;
  }
  //四步模式还是五步模式
  public getMode():boolean{
    return (this.data>>7&1)===1;
  }

  //四步模式下,最后一步是否触发IRQ中断
  public getFrameIrq():boolean{
    return (this.data>>6&1)===1;
  }
}

//方波控制器
class SquareWave{
  public regSquare:SquareRegister;
  //0号还是1号
  public squareId:number;
  //包络是否重新开始
  public envelopeRestart:boolean;
  //包络的分频器
  public envelopeDivider:number;
  //当前当前包络的数值是多少
  public envelopeValue:number;
  //滑音是否重新开始
  public sweepRestart:boolean;
  //滑音的分频器
  public sweepDivider:number;
  //当前方波的频率
  public currPeriod:number; 
  //长度计数器
  public lenCounter:number; 
  // 播放方波时需要缓存的内容
  public squareSeq:ArrayBuffer;
  public squareSeqDataView:DataView;
  //上次运行到方波的什么位置了
  public seqLocOld:number;
  public curSeqIndex:number;
  constructor(_id:number){
    this.squareId=_id;
    this.regSquare=new SquareRegister();
    this.squareSeq=new ArrayBuffer(SAMPLE_PER_CLOCK*4);
    this.squareSeqDataView=new DataView(this.squareSeq);
  }

  //初始化/重置数据
  public reset():void{
    this.regSquare.setData(0,0);
    this.regSquare.setData(1,0);
    this.regSquare.setData(2,0);
    this.regSquare.setData(3,0);
    this.envelopeRestart=false;
    this.envelopeDivider=0;
    this.envelopeValue=0;
    this.sweepRestart=false;
    this.sweepDivider=0;
    this.currPeriod=0;
    this.lenCounter=0;
    this.seqLocOld=0;
    this.curSeqIndex=0;
    this.clearSquareSeq();
  }

  public clearSquareSeq():void{
    for(let i=0,l=this.squareSeq.byteLength;i<l;i++){
      this.squareSeqDataView.setUint8(i,0);
    }
  }

  //CPU向方波寄存器写入数据
  public writeData(index:number,value:number,enable:boolean):void{
    switch(index){
    case 0:
      this.regSquare.setData(0,value);
      break;
    case 1:
      this.regSquare.setData(1,value);
      //写入$4001会重置滑音
      this.sweepRestart=true;
      break;
    case 2:
      this.regSquare.setData(2,value);
      this.currPeriod=this.regSquare.getPeriod();
      break;
    case 3:
      this.regSquare.setData(3,value);
      this.currPeriod=this.regSquare.getPeriod();
      //写入$4003会重置包络
      this.envelopeRestart = true; 
      //在方波启用的情况下，写入$4003会重置长度计数器
      if (enable) 
        this.lenCounter = this.regSquare.getLenCounter();
      //这里先做一个简单的近似处理。在每个clock起始的位置重置方波和改变频率。实际情况应该是写入之后立即重置方波和改变频率，但先允许有1/240秒的误差
      this.seqLocOld = 0;
      break;
    default:
      console.warn('向方波寄存器写入下标0,1,2,3');
      break;
    }
  }

  //触发包络的时钟
  public onEnvelopeClock():void{
    //
    if (this.envelopeRestart){
      //包络重新开始
      this.envelopeRestart = false;
      this.envelopeDivider = this.regSquare.getVolume();
      this.envelopeValue = 15;
    }else{
      if (this.envelopeDivider === 0){
        this.envelopeDivider = this.regSquare.getVolume();
        if (this.envelopeValue === 0){
          if(this.regSquare.getHalt()){
            this.envelopeValue = 15;
          }
        }
        else{
          this.envelopeValue--;
        }
        // else if(this.envelopeValue>0){
        //   this.envelopeValue--;
        // }
      }else{
        this.envelopeDivider--;
      }
    }
  }
  //触发长度寄存器的时钟
  public onLengtClock():void{
    //
    if (!this.regSquare.getHalt()&&this.lenCounter >= 1){
      this.lenCounter -= 1;
    }
  } 
  //触发滑音的时钟
  public onSweepClock():void{
    if (this.sweepDivider === 0 && this.regSquare.getSweep() && this.regSquare.getSweepShift() > 0){
      if (this.currPeriod >= 8 && this.currPeriod <= 0x7ff){
        if (this.regSquare.getSweepNeate()){
          if (this.squareId === 1)
            this.currPeriod = this.currPeriod - (this.currPeriod >> this.regSquare.getSweepShift()) - 1;
          else
            this.currPeriod = this.currPeriod - (this.currPeriod >> this.regSquare.getSweepShift());
        }else{
          this.currPeriod = this.currPeriod + (this.currPeriod >> this.regSquare.getSweepShift());
        }
      }
    }
    if (this.sweepRestart || (this.sweepDivider === 0)){
      //如果滑音重新开始，则重置滑音的分频器，并将重新开始的标志位置为False
      this.sweepRestart = false;
      this.sweepDivider = this.regSquare.getSweepPeriod();
    }else{
      this.sweepDivider--;
    }
  }

  //播放时
  public playOld(clockCnt:number,enable:boolean):void{
    //
    const cpuLocOld:number =Math.floor(clockCnt * CPU_CYCLE_PER_SEC / 240);
    for (let sampleLoc = Math.floor(clockCnt * SAMPLE_PER_SEC / 240 + 1); sampleLoc <= (clockCnt + 1) * SAMPLE_PER_SEC / 240; sampleLoc++){
      //计算这个采样点是否要静音
      let mute = false;
      if ((!enable) || (this.lenCounter === 0)){
        mute = true;
        this.squareSeqDataView.setUint8(this.curSeqIndex,0);
        this.seqLocOld=0;
        this.curSeqIndex++;
        continue;
      }
      else if (this.currPeriod <= 7 || this.currPeriod >= 0x800){
        mute = true;
      }
      //计算这个采样点属于方波的什么位置 CPU频率的什么位置
      const cpuLoc:number = Math.floor(sampleLoc * CPU_CYCLE_PER_SEC / SAMPLE_PER_SEC);
      //这个采样点与时钟触发时的CPU周期间隔数
      const cpuLocDiff:number= Math.floor(cpuLoc - cpuLocOld);
      //这个采样点与时钟触发时相差了多少个方波周期
      const seqDiff:number = cpuLocDiff * 1.0 / (16 * (this.currPeriod + 1));
      //这个采样点在方波的位置
      //C++小数转整数会截掉小数
      const seqLoc:number =(seqDiff + this.seqLocOld) - Math.floor((seqDiff + this.seqLocOld));
      const seqVal:number = SquareWaveMap[this.regSquare.getDuty()][Math.floor(seqLoc* 8)]?1:-1;
      //计算这个采样点的音量
      let volume:number;
      if (mute){
        volume = 0;
      }
      //使用固定音量
      else if (this.regSquare.getEnvelope()){
        volume = this.regSquare.getVolume();
      }
      //使用包络音量
      else{
        volume = this.envelopeValue;
      }
      this.squareSeqDataView.setUint8(this.curSeqIndex,(seqVal * volume)&0xff);
      //收尾操作
      this.curSeqIndex++;
      if (sampleLoc === Math.floor((clockCnt + 1) * SAMPLE_PER_SEC / 240)){
        this.seqLocOld = seqLoc;
      }
    }
  }

  //播放时 test
  public play(clockCnt:number,enable:boolean):void{
    //const cpuLocOld:number =Math.floor(clockCnt * CPU_CYCLE_PER_SEC / 240);
    //采样周期
    const cycle:number=(16*(this.currPeriod+1))/(CPU_CYCLE_PER_SEC/SAMPLE_PER_SEC);
    const sinle:number=cycle/8;
    for (let sampleLoc = 0; sampleLoc <SAMPLE_PER_SEC / 240; sampleLoc++){
      //计算这个采样点是否要静音
      let mute = false;
      if ((!enable) || (this.lenCounter === 0)){
        mute = true;
        this.squareSeqDataView.setUint8(this.curSeqIndex,0);
        this.seqLocOld=0;
        this.curSeqIndex++;
        continue;
      }
      else if (this.currPeriod <= 7 || this.currPeriod >= 0x800){
        mute = true;
      }
      
      if(this.seqLocOld>=cycle){
        this.seqLocOld=0;
      }
      const seqVal:number=SquareWaveMap[this.regSquare.getDuty()][Math.floor(this.seqLocOld/sinle)]?1:-1;
      //计算这个采样点的音量
      let volume:number;
      if (mute){
        volume = 0;
      }
      //使用固定音量
      else if (this.regSquare.getEnvelope()){
        volume = this.regSquare.getVolume();
      }
      //使用包络音量
      else{
        volume = this.envelopeValue;
      }
      this.squareSeqDataView.setUint8(this.curSeqIndex,(seqVal * volume)&0xff);
      //收尾操作
      this.curSeqIndex++;
      this.seqLocOld++;
    }
  }
}


//三角波控制器
class TriangleWave{
  //三角波寄存器
  public triangleReg:TriangularRegister;
  //线性计数器是否重新开始
  public linearRestart:boolean;
  //线性计数器
  public linearCounter:number;
  //长度计数器
  public lenCounter:number;
  //当前三角波频率
  public currPeriod:number;
  //播放三角波时需要的内容
  public triangleSeq:ArrayBuffer;
  public triangleSeqDataView:DataView;
  //当前位置
  public curSeqIndex:number;
  //上次位置
  public seqLocOld:number;
  constructor(){
    this.triangleReg=new TriangularRegister();
    this.triangleSeq=new ArrayBuffer(SAMPLE_PER_CLOCK*4);
    this.triangleSeqDataView=new DataView(this.triangleSeq);
  }

  //重置/初始化
  public reset():void{
    this.triangleReg.setData(0,0);
    this.triangleReg.setData(1,0);
    this.triangleReg.setData(2,0);
    this.triangleReg.setData(3,0);
    this.linearCounter=0;
    this.lenCounter=0;
    this.linearRestart=false;
    this.currPeriod=0;
    this.curSeqIndex=0;
    this.seqLocOld=0;
  }

  public clearTriangleSeq():void{
    for(let i=0,l=this.triangleSeq.byteLength;i<l;i++){
      this.triangleSeqDataView.setUint8(i,0);
    }
  }

  //CPU向寄存器写入数据
  public writeData(index:number,value:number, enable:boolean):void{
    //
    switch(index){
    case 0:
      this.triangleReg.setData(0,value);
      break;
    case 2:
      this.triangleReg.setData(2,value);
      this.currPeriod = this.triangleReg.getPeriod();
      break;
    case 3:
      this.triangleReg.setData(3,value);
      this.currPeriod = this.triangleReg.getPeriod();
      this.linearRestart = true; //写入$400B会重置线性计数器
      if (enable) //在三角波启用的情况下，写入$4003会重置长度计数器
        this.lenCounter = this.triangleReg.getLencounter();
      //和方波不一致的地方是，三角波的波形不会因为寄存器的写入而重置
      break;
    default:
      console.warn('向三角波寄存器写入不存在的Index');
      break;
    }
  }
  //触发长度寄存器的时钟
  public onLengthClock():void{
    //
    if (!this.triangleReg.getHalt()&&this.lenCounter >= 1){
      this.lenCounter -= 1;
    }
  }
  //触发线性计数器的时钟
  public onLinearClock():void{
    //
    if (this.linearRestart){
      this.linearCounter = this.triangleReg.getlineCounter();
    }else if (this.linearCounter >= 1){
      this.linearCounter--;
    }
    // 非halt的情况下，才会清掉restart标志位
    if (!this.triangleReg.getHalt())
      this.linearRestart = false;
  } 
  //播放
  public playOld(clockCnt:number,enable:boolean):void{
    //TODO
    const cpuLocOld:number= Math.floor(clockCnt * CPU_CYCLE_PER_SEC / 240);
    for (let sampleLoc:number=Math.floor(clockCnt * SAMPLE_PER_SEC / 240 + 1); sampleLoc <= (clockCnt + 1) * SAMPLE_PER_SEC / 240; sampleLoc++){
      //计算这个采样点是否要静音. 长度计数器和线性计数器中，只要有一个为零，就静音
      if ((!enable) || (this.lenCounter === 0) || (this.linearCounter === 0)){
        this.triangleSeqDataView.setUint8(this.curSeqIndex,0);
        this.seqLocOld = 0;
        this.curSeqIndex++;
        continue;
      }
      //计算这个采样点属于三角波的什么位置
      const cpuLoc:number = Math.floor(sampleLoc * CPU_CYCLE_PER_SEC / SAMPLE_PER_SEC);
      const cpuLocDiff:number= Math.floor(cpuLoc - cpuLocOld); //这个采样点与时钟触发时的CPU周期间隔数
      const seqDiff:number = cpuLocDiff * 1.0 / (32 * (this.currPeriod + 1)); //这个采样点与时钟触发时相差了多少个方波周期
      const seqLoc:number= (seqDiff + this.seqLocOld) - Math.floor(seqDiff + this.seqLocOld); //这个采样点在方波的位置
      const volume:number = TriangleWaveMap[Math.floor(seqLoc * 32)];
      this.triangleSeqDataView.setUint8(this.curSeqIndex,volume&0xff);
      //收尾操作
      this.curSeqIndex++;
      if (sampleLoc === Math.floor((clockCnt + 1) * SAMPLE_PER_SEC / 240)){
        this.seqLocOld = seqLoc;
      }
    }
  }

  //test
  public play(clockCnt:number,enable:boolean):void{
    //采样周期
    const cycle:number=(32*(this.currPeriod+1))/(CPU_CYCLE_PER_SEC/SAMPLE_PER_SEC);
    const sinle:number=cycle/32;
    for(let sampleLoc=0;sampleLoc<SAMPLE_PER_SEC/240;sampleLoc++){
      //计算这个采样点是否要静音. 长度计数器和线性计数器中，只要有一个为零，就静音
      if ((!enable) || (this.lenCounter === 0) || (this.linearCounter === 0)){
        this.triangleSeqDataView.setUint8(this.curSeqIndex,0);
        this.seqLocOld = 0;
        this.curSeqIndex++;
        continue;
      }
      if(this.seqLocOld>=cycle){
        this.seqLocOld=0;
      }
      const seqVal:number=TriangleWaveMap[Math.floor(this.seqLocOld/sinle)]-8;
      this.triangleSeqDataView.setUint8(this.curSeqIndex,seqVal);
      this.curSeqIndex++;
      this.seqLocOld++;
    }
  }
}

//噪声控制器
class Noise{
  //噪声寄存器
  public noiseReg:NoiseRegister;
  //包络是否重新开始
  public envelopeRestart:boolean;
  //包络的分频器
  public envelopeDivider:number;
  //当前包络的数值是多少
  public envelopeVal:number;
  //长度计数器
  public lenCounter:number; 
  //LSFR寄存器
  public regLfsr:number;
  //播放噪声时需要缓存的内容
  public noiseSeq:ArrayBuffer;
  public noiseSeqDataView:DataView;
  //当前
  public curSeqIndex:number;
  constructor(){
    this.noiseReg=new NoiseRegister();
    this.noiseSeq=new ArrayBuffer(SAMPLE_PER_CLOCK*4);
    this.noiseSeqDataView=new DataView(this.noiseSeq);
  }

  //重置/初始化
  public reset():void{
    this.envelopeRestart=false;
    this.envelopeDivider=0;
    this.envelopeVal=0;
    this.lenCounter=0;
    this.regLfsr=0;
    this.curSeqIndex=0;
    this.clearNoiseSeq();
  }

  public clearNoiseSeq():void{
    for(let i=0,l=this.noiseSeq.byteLength;i<l;i++){
      this.noiseSeqDataView.setUint8(i,0);
    }
  }
  //CPU向寄存器写入数据
  public writeData(index:number,value:number, enable:boolean):void{
    //
    switch(index){
    case 0:
      this.noiseReg.setData(0,value);
      break;
    case 2:
      this.noiseReg.setData(2,value);
      break;
    case 3:
      this.noiseReg.setData(3,value);
      //写入$400F会重置包络
      this.envelopeRestart = true;
      //在噪声启用的情况下，写入$400F会重置长度计数器
      if (enable)
        this.lenCounter = this.noiseReg.getLenCounter();
      break;
    default:
      break;
    }
  }
  //触发长度寄存器的时钟
  public onEnvelopeClock():void{
    //
    if (this.envelopeRestart){
      //包络重新开始
      this.envelopeRestart = false;
      this.envelopeDivider = this.noiseReg.getNoisePeriod();
      this.envelopeVal = 15;
    }else{
      if (this.envelopeDivider === 0){
        this.envelopeDivider = this.noiseReg.getNoisePeriod();
        if (this.envelopeVal === 0){
          if (this.noiseReg.getHalt()){
            this.envelopeVal = 15;
          }
        }else{
          this.envelopeVal--;
        }
      }else{
        this.envelopeDivider--;
      }
    }
  }
  //触发线性计数器的时钟
  public onLengthClock():void{
    //
    if (!this.noiseReg.getHalt()&&this.lenCounter >= 1){
      this.lenCounter -= 1;
    }
  } 
  //播放
  public play(clockCnt:number,enable:boolean):void{
    //
    let cpuLocOld:number = Math.floor(clockCnt * CPU_CYCLE_PER_SEC / 240);
    for (let sampleLoc:number =Math.floor(clockCnt * SAMPLE_PER_SEC / 240 + 1); sampleLoc <= (clockCnt + 1) * SAMPLE_PER_SEC / 240; sampleLoc++){
      //计算这个采样点是否要静音
      if ((!enable) || (this.lenCounter === 0)){
        this.noiseSeqDataView.setUint8(this.curSeqIndex,0);
        this.curSeqIndex++;
        continue;
      }
      //计算这两次采样之间，要进行几次LFSR计算
      const cpuCoc:number = Math.floor(sampleLoc) * CPU_CYCLE_PER_SEC / SAMPLE_PER_SEC;
      const lfsrCount:number= Math.floor((cpuCoc / this.noiseReg.getNoisePeriod()) - (cpuLocOld / this.noiseReg.getNoisePeriod()));
      cpuLocOld = cpuCoc;
      //进行LFSR计算
      let d0:number = this.regLfsr & 1;
      for (let t= 0; t < lfsrCount; t++){
        if (this.noiseReg.getNoiseMode()){
          //短模式
          d0 = this.regLfsr & 1;
          const d6:number = (this.regLfsr & (1 << 6)) ? 1 : 0;
          const yihuo:number = (d0 ^ d6)?1:0;
          this.regLfsr = (this.regLfsr >> 1) | (yihuo << 14);
        }else{
          //长模式
          d0 = this.regLfsr & 1;
          const d1:number = (this.regLfsr & (1 << 1)) ? 1 : 0;
          const yihuo:number = (d0 ^ d1)?1:0;
          this.regLfsr = (this.regLfsr >> 1) | (yihuo << 14);
        }
      }
      //计算这个采样点的音量
      let volume:number;
      if (this.noiseReg.getEnvelope()){ //使用固定音量
        volume = this.noiseReg.getVolume();
      }else{ //使用包络音量
        volume = this.envelopeVal;
      }
      this.noiseSeqDataView.setUint8(this.curSeqIndex,(d0*volume)&0xff);
      //收尾操作
      this.curSeqIndex++;
    }
  }
}

//采样波形
class DPCM{
  public dpcmReg:DPCMRegister;
  //指向下一个要处理的DMAC样本字节
  public currAddress:number;
  //当前的DMAC样本字节
  public currByte:number;
  //还有多少字节没有完成 
  public bytesRemain:number; 
  //这个正在处理的字节，还有多少位没处理完
  public bitsRemain:number;
  //当前缓存的音量 
  public outputLevel:number; 
  //播放DPCM需要缓存的内容
  public dpcmSeq:ArrayBuffer;
  public dpcmSeqDataView:DataView;
  //当前
  public curSeqIndex:number;

  //CPU总线
  public cpuBus:CpuBus;
  constructor(){
    this.dpcmReg=new DPCMRegister();
    this.dpcmSeq=new ArrayBuffer(SAMPLE_PER_CLOCK*4);
    this.dpcmSeqDataView=new DataView(this.dpcmSeq);
  }

  public reset():void{
    this.currAddress=0;
    this.currByte=0;
    this.bytesRemain=0;
    this.bitsRemain=0;
    this.outputLevel=0;
    this.curSeqIndex=0;
    this.clearDpcmSeq();
  }

  public clearDpcmSeq():void{
    for(let i=0,l=this.dpcmSeq.byteLength;i<l;i++){
      this.dpcmSeqDataView.setUint8(i,0);
    }
  }

  public setCpuBus(_cpubus:CpuBus){
    this.cpuBus=_cpubus;
  }

  //CPU向寄存器写入数据
  public writeData(index:number,value:number,enable:boolean):void{
    //
    switch(index){
    case 0:
      this.dpcmReg.setData(0,value);
      break;
    case 1:
      this.dpcmReg.setData(1,value);
      this.outputLevel=this.dpcmReg.getVolume();
      break;
    case 2:
      this.dpcmReg.setData(2,value);
      break;
    case 3:
      this.dpcmReg.setData(3,value);
      this.currAddress = this.dpcmReg.getSampleAddress();
      this.bytesRemain = this.dpcmReg.getSampleLen();
      break;
    default:
      console.warn('向DPCM寄存器写入不存在的Index');
      break;
    }
  }
  //播放
  public play(clockCnt:number,enable:boolean):void{
    //
    let cpuLocOld:number=Math.floor(clockCnt * CPU_CYCLE_PER_SEC / 240);
    for (let sample_loc:number=Math.floor(clockCnt * SAMPLE_PER_SEC / 240 + 1); sample_loc <= (clockCnt + 1) * SAMPLE_PER_SEC / 240; sample_loc++){
      //先计算这个采样点是否要静音
      if (!enable){
        this.dpcmSeqDataView.setUint8(this.curSeqIndex,0);
        this.curSeqIndex++;
        continue;
      }
      //计算这个采样周期内，要做几次DPCM运算
      const cpuLoc:number= Math.floor(sample_loc * CPU_CYCLE_PER_SEC / SAMPLE_PER_SEC);
      const dpcmCount:number = Math.floor((cpuLoc / this.dpcmReg.getPeriod()) - (cpuLocOld / this.dpcmReg.getPeriod()));
      cpuLocOld = cpuLoc;
      //DPCM计算
      for (let t= 0; t < dpcmCount; t++){
        if (this.bytesRemain && (!this.bitsRemain)){
          //当前样本字节已经读完了，load下一个样本字节
          this.currByte = this.cpuBus.getValue(this.currAddress);
          if (this.currAddress === 0xFFFF)
            this.currAddress = 0x8000;
          else
            this.currAddress++;
          this.bytesRemain--;
          this.bitsRemain = 8;
        }
        if (this.bitsRemain){
          //把当前样本字节的音频播放完成 0-127
          if (this.currByte & 1){
            if (this.outputLevel <= 125)
              this.outputLevel += 2;
          }else{
            if (this.outputLevel >= 2)
              this.outputLevel -= 2;
          }
          this.bitsRemain--;
          this.currByte >>= 1;
          //如果播放完成了，而且设置了IRQ中断，则给出一个IRQ中断
          if (this.bitsRemain === 0 && this.bytesRemain === 0){
            if (this.dpcmReg.getIRQ())
              this.cpuBus.getCpu().irq();
            if (this.dpcmReg.getLoop()){
              this.currAddress = this.dpcmReg.getSampleAddress();
              this.bytesRemain = this.dpcmReg.getSampleLen();
            }
          }
        }
      }
      //收尾操作
      this.dpcmSeqDataView.setUint8(this.curSeqIndex,this.outputLevel&0xff);
      this.curSeqIndex++;
    }
  }
}

//APU
export class Apu{
  //两个方波控制器
  public square0:SquareWave;
  public square1:SquareWave;
  //一个三角波控制器
  public triangle:TriangleWave;
  //一个噪声控制器
  public noise:Noise;
  //一个波形采样控制器
  public dpcm:DPCM;
  //APU状态寄存器
  public statusReg:ApuStatusRegister;
  //帧计数器
  public frameCounter:FrameCounter;
  //
  public frameInterrupt:boolean;

  //混音后的数据
  public seq:ArrayBuffer;
  public seqDataView:DataView;
  public seqLen:number;
  //
  public clockCnt:number;
  public play:boolean;

  //CPU总线
  private cpuBus:CpuBus;
  constructor(){
    this.square0=new SquareWave(0);
    this.square1=new SquareWave(1);
    this.triangle=new TriangleWave();
    this.noise=new Noise();
    this.dpcm=new DPCM();
    this.statusReg=new ApuStatusRegister();
    this.frameCounter=new FrameCounter();
    this.seq=new ArrayBuffer(SAMPLE_PER_CLOCK*4);
    this.seqDataView=new DataView(this.seq);
  }


  //重置/初始化
  public reset():void{
    this.square0.reset();
    this.square1.reset();
    this.triangle.reset();
    this.noise.reset();
    this.dpcm.reset();
    this.clearSqe();
    this.frameInterrupt=false;
    this.clockCnt=0;
    this.seqLen=0;
    this.play=false;
  }

  public clearSqe():void{
    for(let i=0,l=this.seq.byteLength;i<l;i++){
      this.seqDataView.setUint8(i,0);
    }
  }

  //设置CPU总线
  public setCpuBus(_cpubus:CpuBus):void{
    this.cpuBus=_cpubus;
    this.dpcm.setCpuBus(this.cpuBus);
  }

  //CPU向APU的各个寄存器写入数据
  public setData(index:number,value:number):void{
    if (index >= 0 && index <= 3){
      //写入方波0的寄存器
      this.square0.writeData(index, value, this.statusReg.getPulse0());
    }else if (index >= 4 && index <= 7){
      //写入方波1的寄存器
      this.square1.writeData(index - 4, value, this.statusReg.getPulse1());
    }else if (index >= 8 && index <= 11){
      //写入三角波的寄存器
      this.triangle.writeData(index - 8, value, this.statusReg.getTriangle());
    }else if (index >= 12 && index <= 15){
      //写入噪声的寄存器
      this.noise.writeData(index - 12, value, this.statusReg.getNoise());
    }else if (index >= 0x10 && index <= 0x13){
      //写入DPCM的寄存器
      this.dpcm.writeData(index - 0x10, value, this.statusReg.getDMC());
    }else if (index === 0x15){
      //写入APU Status
      this.statusReg.setData(value);
      if (this.statusReg.getPulse0() === false)
        this.square0.lenCounter = 0;
      if (this.statusReg.getPulse1() === false)
        this.square1.lenCounter = 0;
      if (this.statusReg.getTriangle() === false)
        this.triangle.lenCounter = 0;
      if (this.statusReg.getNoise() === false)
        this.noise.lenCounter = 0;
    }else if (index === 0x17){
      //写入frame counter
      this.frameCounter.setData(value);
      if (this.frameCounter.getMode()|| (!this.frameCounter.getFrameIrq()))
        this.frameInterrupt = false;
      if (this.frameCounter.getMode()){
        //启用五步模式，会立即产生一个时钟信号
        this.onEnvelopeLinearClock();
        this.onLengthSweepClock();
      }
    }
  }

  public read4015():number{
    let res = 0;
    if (this.square0.lenCounter) res |= 1;
    if (this.square1.lenCounter) res |= (1 << 1);
    if (this.triangle.lenCounter) res |= (1 << 2);
    if (this.noise.lenCounter) res |= (1 << 3);
    if (this.frameInterrupt) res |= (1 << 6);
    if (this.dpcm.bytesRemain) res |= (1 << 4);
    //读取$4015数据时，会立即清掉frameInterrupt
    this.frameInterrupt = false;
    return res;
  }

  public onLengthSweepClock():void{
    this.square0.onLengtClock();
    this.square0.onSweepClock();
    this.square1.onLengtClock();
    this.square1.onSweepClock();
    this.triangle.onLengthClock();
    this.noise.onLengthClock();
  }

  public onEnvelopeLinearClock():void{
    this.square0.onEnvelopeClock();
    this.square1.onEnvelopeClock();
    this.triangle.onLinearClock();
    this.noise.onEnvelopeClock();
  }

  public onFrameIrq():void{
    if (this.frameCounter.getFrameIrq()){
      this.frameInterrupt = true;
      this.cpuBus.getCpu().irq();
    }
  }

  //单步
  public step():void{
    //调整寄存器的数值
    if (this.frameCounter.getMode()){
      switch (this.clockCnt % 5){
      case 0:
        this.onEnvelopeLinearClock();
        break;
      case 1:
        this.onLengthSweepClock();
        this.onEnvelopeLinearClock();
        break;
      case 2:
        this.onEnvelopeLinearClock();
        break;
      case 4:
        this.onLengthSweepClock();
        this.onEnvelopeLinearClock();
        break;
      default:
        break;
      }
    }else{
      switch (this.clockCnt % 4){
      case 0:
        this.onEnvelopeLinearClock();
        break;
      case 1:
        this.onLengthSweepClock();
        this.onEnvelopeLinearClock();
        break;
      case 2:
        this.onEnvelopeLinearClock();
        break;
      case 3:
        this.onLengthSweepClock();
        this.onEnvelopeLinearClock();
        this.onFrameIrq();
        break;
      default:
        break;
      }
    }
    //播放音频
    this.genWave();
    this.clockCnt++;
  }

  //播放一个单位的音频
  public genWave():void{
    //生成方波、三角波、噪音、DPCM
    this.square0.play(this.clockCnt, this.statusReg.getPulse0());
    this.square1.play(this.clockCnt, this.statusReg.getPulse1());
    this.triangle.play(this.clockCnt, this.statusReg.getTriangle());
    this.noise.play(this.clockCnt, this.statusReg.getNoise());
    //TODO
    this.dpcm.play(this.clockCnt, this.statusReg.getNoise());
    this.play=false;
    if (this.clockCnt % 4 === 3){
      //混音
      this.seqLen= this.square0.curSeqIndex;
      for (let t= 0; t <= this.seqLen - 1; t++){
        let volumeTotal= 0;
        //每个值-15至15
        //方波1+方波2占22.56%
        //volumeTotal += 0.00752 * (this.square0.squareSeqDataView.getUint8(t) + this.square1.squareSeqDataView.getUint8(t));
        //三角波占12.765% 噪声波占7.41% DPCM占42.545%
        //volumeTotal += 0.00851 * this.triangle.triangleSeqDataView.getUint8(t) + 0.00494 * this.noise.noiseSeqDataView.getUint8(t) + 0.00335 * this.dpcm.dpcmSeqDataView.getUint8(t);
        //test
        volumeTotal+=2*(this.square0.squareSeqDataView.getUint8(t) + this.square1.squareSeqDataView.getUint8(t));
        volumeTotal+=this.triangle.triangleSeqDataView.getUint8(t);
        //volumeTotal+= 0.12765 * this.triangle.triangleSeqDataView.getInt8(t) + 0.741 * this.noise.noiseSeqDataView.getInt8(t) + 0.42545 * this.dpcm.dpcmSeqDataView.getInt8(t);
        //
        //this.seqDataView.setUint8(t,Math.floor(volumeTotal * 256)&0xff);
        //test
        this.seqDataView.setUint8(t,Math.floor(volumeTotal)&0xff);
      }
      //将各个波形中的一些缓存数据清零
      this.square0.clearSquareSeq();
      this.square1.clearSquareSeq();
      this.triangle.clearTriangleSeq();
      this.noise.clearNoiseSeq();
      this.dpcm.clearDpcmSeq();
      this.square0.curSeqIndex= 0;
      this.square1.curSeqIndex = 0;
      this.triangle.curSeqIndex = 0;
      this.noise.curSeqIndex = 0;
      this.dpcm.curSeqIndex = 0;
      this.play=true;
    }
  }
}