import { Cpu } from './cpu';
import { CpuBus } from './cpuBus';
import {CartridgeReader} from './cartridge';
import { Ppu } from './ppu';
import { PpuBus } from './ppuBus';

//主控接口
export class Main{
  //CPU总线
  private cpubus:CpuBus;
  //CPU
  private cpu:Cpu;
  //PPU总线
  private ppuBus:PpuBus;
  //PPU
  private ppu:Ppu;
  //卡带
  private cartridge:CartridgeReader;
  //画布
  private canvas:HTMLCanvasElement;
  private div:HTMLDivElement;
  private input:HTMLInputElement;

  //一些配置
  //程序逻辑帧率 60的正整数倍 
  private logicBaseFPS:number;
  private logicFPS:number;
  //渲染帧率固定在60
  private renderFPS:number;
  //下次程序帧调用时间
  private nextLogicTime:number;
  //下次渲染帧调用时间
  private nextRenderTime:number;
  //是否暂停
  private isPause:boolean;
  constructor(){
    this.cpubus=new CpuBus();
    this.cpu=new Cpu();
    this.ppuBus=new PpuBus();
    this.ppu=new Ppu();
    this.cpu.setCpuBus(this.cpubus);
    this.ppu.setCpu(this.cpu);
    this.ppu.setPpuBus(this.ppuBus);
    this.cpubus.setCpu(this.cpu);
    this.cpubus.setPpu(this.ppu);
    this.cartridge=new CartridgeReader();
    this.canvas=document.createElement('canvas');
    this.canvas.width=256;
    this.canvas.height=256;
    this.logicBaseFPS=60;
    this.logicFPS=60;
    this.renderFPS=60;
    this.nextLogicTime=0;
    this.nextRenderTime=0;
    this.isPause=true;
    this.setCartidegData=this.setCartidegData.bind(this);
    this.step=this.step.bind(this);
    this.setInputData=this.setInputData.bind(this);
    this.enterFrame=this.enterFrame.bind(this);
  }

  //设置卡带数据
  public setCartidegData(data:ArrayBuffer):void{
    this.cartridge.resetData(data);
    this.cpubus.setCartridgeReader(this.cartridge);
    this.cpu.reset();
    this.ppu.reset();
    this.ppuBus.reset();
    //测试
    this.start();
  }

  //主循环
  public step():number{
    const lastFrame=this.ppu.frameFinished;
    //渲染一帧画面
    while(this.ppu.frameFinished === lastFrame)
    {
    //let laseScanline = ppu.scanline;
    //ppu3轮 cpu一轮
      this.ppu.step();
      this.ppu.step();
      this.ppu.step();
      this.cpu.step();
    // if ((ppu.scanline === 65 || ppu.scanline === 130 || ppu.scanline === 195 || ppu.scanline === 260) && ppu.scanline !== laseScanline)
    //   Apu.run_1cycle();
    }
    return 0;
  }

  //开始以固定帧执行程序,渲染画面
  private enterFrame():void{
    if(!this.isPause){
      const nowTime:number=Date.now();
      //逻辑帧是否执行
      if(!this.nextLogicTime){
        this.nextLogicTime=nowTime+1000/this.logicFPS;
        this.step();
      }else{
        //程序帧可以变得比默认帧率快
        while(nowTime<this.nextLogicTime){
          this.nextLogicTime+=1000/this.logicFPS;
          this.step();
        }
      } 
      //渲染帧是否执行
      if(!this.nextRenderTime){
        this.nextRenderTime=nowTime+1000/this.renderFPS;
        this.drawFrame(this.ppu.frameDataView,256,240);
      }
      //渲染帧率则不超过60帧
      else if(nowTime<this.nextRenderTime){
        this.nextRenderTime+=1000/this.renderFPS;
      }
      window.requestAnimationFrame(this.enterFrame);
    }
  }

  //开始运行
  public start():void{
    this.isPause=false;
    this.enterFrame();
  }

  //暂停
  public puase():void{
    this.isPause=true;
  }

  //渲染一帧数据
  private drawFrame(data:DataView,width:number,height:number):void{
    const ctx:CanvasRenderingContext2D=this.canvas.getContext('2d');
    const imageData:ImageData=ctx.createImageData(width,height);
    const len:number=width*height*4;
    for(let i=0;i<len;i++){
      imageData.data[i]=data.getUint8(i);
    }
    ctx.putImageData(imageData,0,0);
  }

  //INPUT组件输入数据
  public setInputData(evt:Event):void{
    const target=<HTMLInputElement>evt.currentTarget;
    const file=target.files[0];
    file.arrayBuffer().then((value:ArrayBuffer)=>{
      this.setCartidegData(value);
    });
  }
  //获取div
  public inputComponent():HTMLElement{
    if(!this.div){
      this.div= document.createElement('div');
    }
    if(!this.input){
      this.input= document.createElement('input');
      this.input.type='file';
      this.input.name='点击上传文件';
      this.input.addEventListener('change',this.setInputData);
      this.div.appendChild(this.input);
    }
    return this.div;
  }
  
  //获取Canvas
  public canvasComponent():HTMLCanvasElement{
    if(!this.canvas.getContext){
      throw new Error('哦豁,你的浏览器不支持canvas');
    }
    return this.canvas;
  }
}
//document.body.appendChild(inputComponent());