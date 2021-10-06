//声音处理

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

const PulseWave:Array<Array<boolean>> =[
  [false,true,false, false,false, false, false, false],
  [false,true,true, false, false, false, false, false],
  [false,true,true, true, true, false, false, false],
  [true, false, false, true, true, true, true, true]
];

const TriangleWave:Array<number> = [
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
export class SquareRegister{
  //4字节数据
  private data:Array<number>;
  constructor(){
    this.data.length=4;
    this.data[0]=0;
    this.data[1]=0;
    this.data[2]=0;
    this.data[3]=0;
  }

  //获取方波的占空比信息byte0 bit6,bit7
  public getDuty():number{
    return this.data[0]>>6;
  }

  //获取是否持续播放byte0 bit5
  public getHalt():boolean{
    return (this.data[0]>>5&1)===1;
  }

  //获取是否包络byte0  bit4
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
export class TriangularRegister{
    private data:Array<number>
    constructor(){
      this.data.length=4;
      this.data[0]=0;
      this.data[1]=0;
      this.data[2]=0;
      this.data[3]=0;
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
export class NoiseRegister{
  private data:Array<number>;
  constructor(){
    this.data.length=4;
    this.data[0]=0;
    this.data[1]=0;
    this.data[2]=0;
    this.data[3]=0;
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
export class DPCMRegister{
  private data:Array<number>;
  constructor(){
    this.data.length=4;
    this.data[0]=0;
    this.data[1]=0;
    this.data[2]=0;
    this.data[3]=0;
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
export class ApuStatusRegister{
  private data:number;
  constructor(){
    this.data=0;
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
export class FrameCounter{
  public data:number;
  constructor(){
    this.data=0;
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