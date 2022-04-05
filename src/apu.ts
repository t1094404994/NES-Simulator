//声音处理

import { CpuBus } from './cpuBus';
import { CPU_CYCLE_PER_FRAME, CPU_CYCLE_PER_SEC} from './cpu';

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
//每次采样的周期
const CPU_CYCLE_PER_SAMPLE=CPU_CYCLE_PER_SEC/SAMPLE_PER_SEC;
//一帧需要的采样数
export const SAMPLE_PER_FRAME=SAMPLE_PER_SEC/60;
//一次需要的采样数
const SAMPLE_PER_CLOCK=Math.floor(SAMPLE_PER_SEC / 240 + 1);

//方波寄存器
class SquareRegister{
  //4字节数据
  private data:Array<number>
  //使能
  private statusWrite:boolean
  constructor(){
    this.data=[];
    this.statusWrite=false;
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
  }

  public setData(index:number,value:number):void{
    this.data[index]=value;
  }
  public setStatusWrite(status:boolean):void{
    this.statusWrite=status;
  }
  public getStatusWrite():boolean{
    return this.statusWrite;
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
    private statusWrite:boolean
    constructor(){
      this.statusWrite=false;
      this.data=[];
      this.data.push(0);
      this.data.push(0);
      this.data.push(0);
      this.data.push(0);
    }
    public setData(index:number,value:number):void{
      this.data[index]=value;
    }
    public setStatusWrite(status:boolean):void{
      this.statusWrite=status;
    }
    public getStatusWrite():boolean{
      return this.statusWrite;
    }
    //获取三角波是否持续播放
    public getHalt():boolean{
      return (this.data[0]>>7&1)===1;
    }

    //获取线性计数器的重载值
    public getlineCounter():number{
      return this.data[0]&0x7f;
    }

    //获取周期数值
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
  private statusWrite:boolean
  constructor(){
    this.statusWrite=false;
    this.data=[];
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
    this.data.push(0);
  }

  public setData(index:number,value:number):void{
    this.data[index]=value;
  }

  public setStatusWrite(status:boolean):void{
    this.statusWrite=status;
  }
  public getStatusWrite():boolean{
    return this.statusWrite;
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
  private statusWrite:boolean
  constructor(){
    this.statusWrite=false;
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

  public setStatusWrite(status:boolean):void{
    this.statusWrite=status;
  }
  public getStatusWrite():boolean{
    return this.statusWrite;
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
    return this.data[2]<<6|0xc000;
  }

  //获取样本的长度
  public getSampleLen():number{
    return this.data[3]<<4|1;
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
  //当前方波的频率(APU)
  public currPeriod:number; 
  public currCpuPeriod:number; 
  //长度计数器
  public lenCounter:number; 
  // 播放方波时需要缓存的内容
  public squareSeq:ArrayBuffer;
  public squareSeqDataView:DataView;
  //上次运行到方波的什么位置了
  public cycle:number;
  public index:number;
  constructor(_id:number){
    this.squareId=_id;
    this.regSquare=new SquareRegister();
    this.squareSeq=new ArrayBuffer(SAMPLE_PER_FRAME);
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
    this.currPeriod=1;
    this.currCpuPeriod=2;
    this.lenCounter=0;
    this.cycle=0;
    this.index=0;
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
      //周期是否有问题 TODO
      this.currPeriod=this.regSquare.getPeriod();
      break;
    case 3:
      this.regSquare.setData(3,value);
      this.currPeriod=this.regSquare.getPeriod();
      this.currCpuPeriod=this.currPeriod*2;
      //写入$4003会重置包络
      this.envelopeRestart = true; 
      //在方波启用的情况下，写入$4003会重置长度计数器
      if (enable) 
        this.lenCounter = this.regSquare.getLenCounter();
      this.cycle = 0;
      this.index=0;
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
  public play(start:number,end:number):void{
    const enable=this.regSquare.getStatusWrite();
    for (let sampleLoc = start; sampleLoc <end; sampleLoc++){
      //计算这个采样点是否要静音
      let mute = false;
      if ((!enable) || (this.lenCounter === 0)){
        mute = true;
        this.squareSeqDataView.setUint8(sampleLoc,0);
        this.cycle=0;
        this.index=0;
        continue;
      }
      else if (this.currPeriod <= 7 || this.currPeriod >= 0x800){
        mute = true;
      }
      this.cycle+=CPU_CYCLE_PER_SAMPLE*0.5;
      const count=Math.floor(this.cycle/this.currPeriod);
      this.cycle-=count*this.currPeriod;
      this.index+=count;
      if(this.index>=8){
        this.index=this.index%8;
      }
      const seqVal:number=SquareWaveMap[this.regSquare.getDuty()][this.index]?1:-1;
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
      this.squareSeqDataView.setUint8(sampleLoc,(seqVal * volume)&0xff);
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
  //当前三角波频率 不是整体周期
  public currPeriod:number;
  //播放三角波时需要的内容
  public triangleSeq:ArrayBuffer;
  public triangleSeqDataView:DataView;
  //周期计数
  public cycle:number;
  //索引
  public index:number;
  private incMask:number;
  private playMask:number;
  constructor(){
    this.triangleReg=new TriangularRegister();
    this.triangleSeq=new ArrayBuffer(SAMPLE_PER_FRAME);
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
    this.currPeriod=1;
    this.cycle=0;
    this.index=0;
    this.incMask=0;
    this.playMask=0;
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
    case 1:
      console.log('向0x4009,不会用到的index写入数据');
      break;
    case 2:
      this.triangleReg.setData(2,value);
      this.currPeriod = this.triangleReg.getPeriod();
      this.setMask();
      break;
    case 3:
      this.triangleReg.setData(3,value);
      this.currPeriod = this.triangleReg.getPeriod();
      this.linearRestart = true; //写入$400B会重置线性计数器
      if (enable) //在三角波启用的情况下，写入$4003会重置长度计数器
        this.lenCounter = this.triangleReg.getLencounter();
      //和方波不一致的地方是，三角波的波形不会因为寄存器的写入而重置
      this.setMask();
      break;
    default:
      console.warn('向三角波寄存器写入不存在的Index');
      break;
    }
  }

  public setMask():void{
    this.incMask=(this.lenCounter&&this.linearCounter)?0xff:0;
    this.playMask=this.triangleReg.getStatusWrite()?0xf:0;
  }

  //触发长度寄存器的时钟
  public onLengthClock():void{
    //没有暂停长度计数器/线性计数器
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
    // 暂停长度计数器/线性计数器的情况下，才会清掉restart标志位
    if (!this.triangleReg.getHalt())
      this.linearRestart = false;
  } 

  //生成的数据没问题，可能是周期不同步或者什么原因
  public play(start:number,end:number):void{
    const enable=this.triangleReg.getStatusWrite();
    //采样周期 三角波是特例，以CPU周期为单位
    for(let sampleLoc=start;sampleLoc<end;sampleLoc++){
      //计算这个采样点是否要静音.
      if (!enable||this.lenCounter===0||this.linearCounter===0){
        this.triangleSeqDataView.setUint8(sampleLoc,0);
        // this.cycle = 0;
        // this.index=0;
        continue;
      }
      this.cycle+=CPU_CYCLE_PER_SAMPLE;
      const count=Math.floor(this.cycle/this.currPeriod);
      this.cycle-=count*this.currPeriod;
      // this.index+=this.incMask&count;
      this.index+=count;
      //count可能大于1，所以取余
      if(this.index>=TriangleWaveMap.length){
        this.index=this.index%TriangleWaveMap.length;
      }
      // const seqVal:number=TriangleWaveMap[this.index]&this.playMask;
      const seqVal:number=TriangleWaveMap[this.index];
      this.triangleSeqDataView.setUint8(sampleLoc,seqVal);
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
  public output:number
  public cycle:number;
  //播放噪声时需要缓存的内容
  public noiseSeq:ArrayBuffer;
  public noiseSeqDataView:DataView;
  constructor(){
    this.noiseReg=new NoiseRegister();
    this.noiseSeq=new ArrayBuffer(SAMPLE_PER_FRAME);
    this.noiseSeqDataView=new DataView(this.noiseSeq);
  }

  //重置/初始化
  public reset():void{
    this.envelopeRestart=false;
    this.envelopeDivider=0;
    this.envelopeVal=0;
    this.lenCounter=0;
    this.output=0;
    this.regLfsr=1;
    this.cycle=0;
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
      this.envelopeDivider = this.noiseReg.getVolume();
      this.envelopeVal = 15;
    }else{
      if (this.envelopeDivider === 0){
        this.envelopeDivider = this.noiseReg.getVolume();
        if (this.envelopeVal === 0){
          if(this.noiseReg.getHalt()){
            this.envelopeVal = 15;
          }
        }
        else{
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
  
  public setLfsr():void{
    //进行LFSR计算
    const d0:number = this.regLfsr & 1;
    let output:number;
    if (this.noiseReg.getNoiseMode()){
      //短模式
      const d6:number = (this.regLfsr>>6 & 1);
      output = (d0 ^ d6)?1:0;
      this.regLfsr = (this.regLfsr >> 1) | (output << 14);
    }else{
      //长模式
      const d1:number = (this.regLfsr>>1 & 1);
      output = (d0 ^ d1)?1:0;
      this.regLfsr = (this.regLfsr >> 1) | (output << 14);
    }
    //计算这个采样点的音量
    let volume:number;
    if (this.noiseReg.getEnvelope()){ //使用固定音量
      volume = this.noiseReg.getVolume();
    }else{ //使用包络音量
      volume = this.envelopeVal;
    }
    this.output=volume*output;
  }

  //播放
  public play(start:number,end:number):void{
    const enable=this.noiseReg.getStatusWrite();
    for(let sample_loc=start;sample_loc<end;sample_loc++){
      //禁用或者已经输出完毕
      if (!enable||(this.lenCounter===0)){
        this.noiseSeqDataView.setUint8(sample_loc,0);
        this.cycle=0;
        continue;
      }
      this.cycle+=CPU_CYCLE_PER_SAMPLE;
      const count=Math.floor(this.cycle/this.noiseReg.getNoisePeriod());
      this.cycle-=count*this.noiseReg.getNoisePeriod();
      for(let i=0;i<count;i++){
        this.setLfsr();
      }
      this.noiseSeqDataView.setUint8(sample_loc,this.output);
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
  //当前字节还有多少位没有读完 
  public byteRemain:number;
  //当前缓存的音量 
  public outputLevel:number; 
  //播放DPCM需要缓存的内容
  public dpcmSeq:ArrayBuffer;
  public dpcmSeqDataView:DataView;
  //当前周期计数
  private cycle:number;
  //CPU总线
  public cpuBus:CpuBus;
  constructor(){
    this.dpcmReg=new DPCMRegister();
    this.dpcmSeq=new ArrayBuffer(SAMPLE_PER_CLOCK*4);
    this.dpcmSeqDataView=new DataView(this.dpcmSeq);
    this.cycle=0;
  }

  public reset():void{
    this.currAddress=0;
    this.currByte=0;
    this.bytesRemain=0;
    this.outputLevel=0;
    this.cycle=0;
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
      this.currAddress = this.dpcmReg.getSampleAddress();
      break;
    case 3:
      this.dpcmReg.setData(3,value);
      this.bytesRemain = this.dpcmReg.getSampleLen();
      break;
    default:
      console.warn('向DPCM寄存器写入不存在的Index');
      break;
    }
  }
  //进行一次DPCM数据写入
  public setDpmc():void{
    if (this.bytesRemain && (!this.byteRemain)){
      //当前样本字节已经读完了，load下一个样本字节
      this.currByte = this.cpuBus.getValue(this.currAddress);
      if (this.currAddress === 0xFFFF)
        this.currAddress = 0x8000;
      else
        this.currAddress++;
      this.bytesRemain--;
      this.byteRemain = 8;
    }
    if (this.byteRemain){
      //把当前样本字节的音频播放完成 0-127
      if (this.currByte & 1){
        if (this.outputLevel <= 125)
          this.outputLevel += 2;
      }else{
        if (this.outputLevel >= 2)
          this.outputLevel -= 2;
      }
      this.byteRemain--;
      this.currByte >>= 1;
    }
    //如果播放完成了，而且设置了IRQ中断，则给出一个IRQ中断
    if (this.byteRemain === 0 && this.bytesRemain === 0){
      if (this.dpcmReg.getIRQ())
        this.cpuBus.tryIRQ();
      if (this.dpcmReg.getLoop()){
        this.currAddress = this.dpcmReg.getSampleAddress();
        this.bytesRemain = this.dpcmReg.getSampleLen();
      }
    }
  }

  public restart(){
    this.currAddress = this.dpcmReg.getSampleAddress();
    this.bytesRemain = this.dpcmReg.getSampleLen();
  }

  public play(start:number,end:number):void{
    // //如果已经读取完成。
    if(!this.bytesRemain){
      return;
    }
    const enable=this.dpcmReg.getStatusWrite();
    //FC中的PCM原始周期
    const fcPeriod=this.dpcmReg.getPeriod();
    //根据现在设置的采样率。算出新周期 A/T1=B/T2
    const period=SAMPLE_PER_SEC*fcPeriod/CPU_CYCLE_PER_SEC;
    for(let sample_loc=start;sample_loc<end;sample_loc++){
      if(!enable||!this.bytesRemain){
        this.dpcmSeqDataView.setInt8(sample_loc,0);
        this.cycle=0;
        continue;
      }
      this.cycle+=CPU_CYCLE_PER_SAMPLE;
      if(this.cycle>period){
        this.cycle-=period;
        this.setDpmc();
      }
      this.dpcmSeqDataView.setInt8(sample_loc,this.outputLevel);
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
  public seqDataArr:Array<number>
  public clockCnt:number;
  //上次生成数据时的cpu周期/帧
  public lastCytle:number;

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
    //16bit
    this.seq=new ArrayBuffer(SAMPLE_PER_FRAME*2);
    this.seqDataView=new DataView(this.seq);
    this.seqDataArr=[];
    this.seqDataArr.length=SAMPLE_PER_FRAME;
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
    this.lastCytle=0;
  }

  public clearSqe():void{
    for(let i=0,l=this.seq.byteLength;i<l;i++){
      this.seqDataView.setUint8(i,0);
    }
    for(let i=0,l=this.seqDataArr.length;i<l;i++){
      this.seqDataArr[i]=0;
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
      this.square0.regSquare.setStatusWrite(this.statusReg.getPulse0());
      this.square1.regSquare.setStatusWrite(this.statusReg.getPulse1());
      this.triangle.triangleReg.setStatusWrite(this.statusReg.getTriangle());
      this.noise.noiseReg.setStatusWrite(this.statusReg.getNoise());
      this.dpcm.dpcmReg.setStatusWrite(this.statusReg.getDMC());
      if (this.statusReg.getPulse0() === false)
        this.square0.lenCounter = 0;
      if (this.statusReg.getPulse1() === false)
        this.square1.lenCounter = 0;
      if (this.statusReg.getTriangle() === false)
        this.triangle.lenCounter = 0;
      if (this.statusReg.getNoise() === false)
        this.noise.lenCounter = 0;
      //DPMC
      if(this.statusReg.getDMC()===false){
        this.dpcm.bytesRemain=0;
      }else if(!this.dpcm.bytesRemain){
        //重启DPMC
        this.dpcm.restart();
      }
    }else if (index === 0x17){
      //写入frame counter
      this.frameCounter.setData(value);
      if (value&0x40){
        this.frameInterrupt = false;
      }
      if (value&0x80){
        //启用五步模式，会立即产生一个时钟信号
        this.onEnvelopeLinearClock();
        this.onLengthSweepClock();
      }
    }
    //触发一次音频事件
    this.genWave(this.cpuBus.getCpuCycleFrame());
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
    this.cpuBus.IrqAcknowledge();
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
    //TODO APU执行可中断屏蔽还有点问题。
    if (!this.frameCounter.getFrameIrq()){
      this.frameInterrupt = true;
      this.cpuBus.tryIRQ();
    }
  }

  //单步
  public step(cytle:number):void{
    //调整寄存器的数值
    if (this.frameCounter.getMode()){
      switch (this.clockCnt % 5){
      case 0:
        this.onEnvelopeLinearClock();
        break;
      case 1:
        this.onLengthSweepClock();
        break;
      case 2:
        this.onEnvelopeLinearClock();
        break;
      case 3:
        this.onLengthSweepClock();
        break;
      case 4:
        this.onEnvelopeLinearClock();
        break;
      default:
        break;
      }
    }else{
      switch (this.clockCnt % 4){
      case 0:
        this.onFrameIrq();
        break;
      case 1:
        this.onLengthSweepClock();
        break;
      case 2:
        break;
      case 3:
        this.onLengthSweepClock();
        break;
      default:
        break;
      }
      this.onEnvelopeLinearClock();
    }
    //播放音频
    this.genWave(cytle);
    this.clockCnt++;
  }

  public mix():void{
    //混音
    let output=0;
    let pulseOut=0;
    let tndOut=0;
    let pulse0=0;
    let pulse1=0;
    let triangle=0;
    let noise=0;
    let dpmc=0;
    //产生噪音的原因在于每次音频衔接没有完美接上 TODO
    for (let t= 0; t < SAMPLE_PER_FRAME; t++){
      pulse0=this.square0.squareSeqDataView.getInt8(t);
      pulse1=this.square1.squareSeqDataView.getInt8(t);
      triangle=this.triangle.triangleSeqDataView.getInt8(t);
      noise=this.noise.noiseSeqDataView.getInt8(t);
      dpmc=this.dpcm.dpcmSeqDataView.getInt8(t);
      pulseOut=95.88/((8128/(pulse0+pulse1))+100);
      tndOut=159.79/((1/((triangle/8227)+(noise/12241)+(dpmc/22638)))+100);
      output=pulseOut+tndOut;
      this.seqDataView.setInt16(t*2,Math.floor(output*100*0xff));
      this.seqDataArr[t]=output;
    }
  }

  public clearAudio():void{
    //将各个波形中的一些缓存数据清零
    this.square0.clearSquareSeq();
    this.square1.clearSquareSeq();
    this.triangle.clearTriangleSeq();
    this.noise.clearNoiseSeq();
    this.dpcm.clearDpcmSeq();
  }

  public setAudio(start:number,end:number):void{
    if(start>=end) return;
    if(end>SAMPLE_PER_FRAME){
      end=SAMPLE_PER_FRAME;
    }
    this.square0.play(start,end);
    this.square1.play(start,end);
    this.triangle.play(start,end);
    this.noise.play(start,end);
    this.dpcm.play(start,end);
  }

  //播放一个单位的音频
  public genWave(cytle:number):void{
    //生成方波、三角波、噪音、DPCM数据
    const start=Math.floor(this.lastCytle/CPU_CYCLE_PER_SAMPLE);
    const end=Math.floor(cytle/CPU_CYCLE_PER_SAMPLE);
    this.lastCytle=cytle;
    this.setAudio(start,end);
  }

  //播放该帧的音频数据
  public playAudio():void{
    //混音
    this.mix();
    //清除各个乐器的数据
    this.clearAudio();
  }

  //补完该帧的数据(如果原本没有写完)
  public finish():void{
    const lastIndex=Math.floor(this.lastCytle/CPU_CYCLE_PER_SAMPLE);
    this.setAudio(lastIndex,SAMPLE_PER_FRAME);
    this.lastCytle=0;
    this.playAudio();
  }
}