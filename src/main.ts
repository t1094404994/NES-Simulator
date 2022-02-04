import { Cpu } from './cpu';
import { CpuBus } from './cpuBus';
import {CartridgeReader} from './cartridge';
import { Ppu } from './ppu';
import { PpuBus } from './ppuBus';
import { Controller } from './controller';
import { Apu } from './apu';
import {RegionZoom} from './util/math';

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
  //APU
  private apu:Apu;
  //控制器
  private controllerL:Controller;
  private controllerR:Controller;
  //画布
  private canvas:HTMLCanvasElement;
  private canvasDiv:HTMLDivElement;
  //上传框
  private inputDiv:HTMLDivElement;
  private input:HTMLInputElement;
  //音频上下文
  private audio:AudioContext;

  private audioSource:AudioBufferSourceNode;
  private audioSourceEnd:boolean;

  //渲染数据
  private imageData:ImageData;

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
    this.initNes();
    this.initConfig();
    this.setCartidegData=this.setCartidegData.bind(this);
    this.step=this.step.bind(this);
    this.setInputData=this.setInputData.bind(this);
    this.enterFrame=this.enterFrame.bind(this);
    this.onDropover=this.onDropover.bind(this);
    this.onDrag=this.onDrag.bind(this);
    this.onkeyboardEvent=this.onkeyboardEvent.bind(this);
  }

  private initNes():void{
    this.cpubus=new CpuBus();
    this.cpu=new Cpu();
    this.ppuBus=new PpuBus();
    this.ppu=new Ppu();
    this.apu=new Apu();
    this.controllerL=new Controller();
    this.controllerR=new Controller();
    this.cpu.setCpuBus(this.cpubus);
    this.ppu.setCpu(this.cpu);
    this.ppu.setPpuBus(this.ppuBus);
    this.apu.setCpuBus(this.cpubus);
    this.cpubus.setCpu(this.cpu);
    this.cpubus.setPpu(this.ppu);
    this.cpubus.setApu(this.apu);
    this.cpubus.setControllerL(this.controllerL);
    this.cpubus.setControllerR(this.controllerR);
    this.cartridge=new CartridgeReader();
    this.imageData=new ImageData(256,240);
  }

  private initConfig():void{
    this.canvas=document.createElement('canvas');
    this.canvas.width=256;
    this.canvas.height=256;
    this.logicBaseFPS=60;
    this.logicFPS=60;
    this.renderFPS=60;
    this.nextLogicTime=0;
    this.nextRenderTime=0;
    this.isPause=true;
    this.audioSourceEnd=true;
  }

  //设置卡带数据
  public setCartidegData(data:ArrayBuffer):void{
    this.removeControllerEvent();
    const sync:boolean=this.cartridge.resetData(data);
    if(sync){
      this.cpubus.setCartridgeReader(this.cartridge);
      this.ppuBus.setCartridgeReader(this.cartridge);
      this.cpu.reset();
      this.ppu.reset();
      this.apu.reset();
      this.ppuBus.reset();
      this.controllerL.reset(true);
      this.controllerR.reset(false);
      this.addControllerEvent();
      //测试
      this.start();
    }
  }

  //主循环
  public step():number{
    const lastFrame=this.ppu.frameFinished;
    //渲染一帧画面
    while(this.ppu.frameFinished === lastFrame)
    {
      const laseScanline:number = this.ppu.scanline;
      //ppu3轮 cpu一轮
      this.ppu.step();
      this.ppu.step();
      this.ppu.step();
      this.cpu.step();
      //FC渲染一帧画面，会产生四次音频数据
      if ((this.ppu.scanline === 65 || this.ppu.scanline === 130 || this.ppu.scanline === 195 || this.ppu.scanline === 260) && this.ppu.scanline !== laseScanline){
        this.apu.step();
      }
    }
    this.audioPlay();
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
        //逻辑帧可以变得比默认帧率快
        while(nowTime>this.nextLogicTime){
          this.nextLogicTime+=1000/this.logicFPS;
          this.step();
          //TODO
        }
      } 
      //渲染帧是否执行
      if(!this.nextRenderTime){
        this.nextRenderTime=nowTime+1000/this.renderFPS;
        this.drawFrame(this.ppu.frameDataView,256,240);
      }
      //渲染帧率则不超过60帧
      else if(nowTime>this.nextRenderTime){
        this.nextRenderTime+=1000/this.renderFPS;
        this.drawFrame(this.ppu.frameDataView,256,240);
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
    //不重置，则从暂停恢复后就会运行暂停时间内的代码
    this.nextLogicTime=0;
    this.nextRenderTime=0;
  }

  //渲染一帧数据
  private drawFrame(data:DataView,width:number,height:number):void{
    const ctx:CanvasRenderingContext2D=this.canvas.getContext('2d');
    //const imageData:ImageData=ctx.createImageData(width,height);
    const len:number=width*height*4;
    for(let i=0;i<len;i++){
      this.imageData.data[i]=data.getUint8(i);
    }
    ctx.putImageData(this.imageData,0,0);
    //console.log('渲染一帧画面');
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
    if(!this.inputDiv){
      this.inputDiv= document.createElement('div');
    }
    if(!this.input){
      this.input= document.createElement('input');
      this.input.type='file';
      this.input.name='点击上传文件';
      this.input.addEventListener('change',this.setInputData);
      this.inputDiv.appendChild(this.input);
    }
    return this.inputDiv;
  }

  //获取Canvas
  public canvasComponent():HTMLElement{
    if(!this.canvas.getContext){
      throw new Error('哦豁,你的浏览器不支持canvas');
    }
    if(!this.canvasDiv){
      this.canvasDiv=document.createElement('div');
      this.canvasDiv.appendChild(this.canvas);
      this.canvasDiv.addEventListener('drop',this.onDropover);
      this.canvasDiv.addEventListener('dragEnter',this.onDrag);
      this.canvasDiv.addEventListener('dragover',this.onDrag);
    }
    return this.canvasDiv;
  }

  //必须要取消默认事件，才能触发drop
  public onDrag(evt:DragEvent):void{
    if(evt){
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  //拖入
  public onDropover(evt:DragEvent):void{
    //停止默认行为和冒泡
    if(evt){
      evt.preventDefault();
      evt.stopPropagation();
    }
    //这里指需要单个文件，不需要items和reader
    if(evt.dataTransfer.files&&evt.dataTransfer.files[0]){
      const file:File=evt.dataTransfer.files[0];
      file.arrayBuffer().then((value:ArrayBuffer)=>{
        this.setCartidegData(value);
      });
    }
  }

  //测试自己创建数据，喂数据给 audio
  public audioPlay():void{
    const AudioContext = window.AudioContext;
    if(AudioContext){
      const allFrame:number=this.apu.seqLen;
      if(allFrame===0){
        return;
      }
      //创建音频上下文
      if(this.audio===undefined) this.audio=new AudioContext();
      const audioCtx:AudioContext=this.audio;
      //双声道
      const channels=2;
      //创建音频数据源
      const audiobuffer:AudioBuffer=audioCtx.createBuffer(channels,allFrame,44100);
      for(let i=0;i<channels;i++){
        const buffer:Float32Array=audiobuffer.getChannelData(i);
        for(let i=0;i<allFrame;i++){
          //[-1,1]
          // buffer[i]=RegionZoom(this.apu.seqDataView.getInt8(i),-127,127,-1,1);
          // buffer[i]=RegionZoom(this.apu.seqDataView.getInt16(i*2),-32767,32767,-1,1);
          buffer[i]=this.apu.seqDataArr[i];
        }
      }
      //创建音频资源节点
      this.audioSource=audioCtx.createBufferSource();
      this.audioSource.buffer=audiobuffer;
      //把节点连接到声音环境
      this.audioSource.connect(audioCtx.destination);
      this.audioSource.start();
      this.audioSourceEnd=false;
      // this.audioSource.addEventListener('ended',()=>{
      //   this.audioSourceEnd=true;
      // });
    }
  }

  //移除元素后，移除监听
  public disposeComponent():void{
    // this.canvasDiv.removeEventListener('drop',this.onDropover);
    // this.canvasDiv.removeEventListener('dragEnter',this.onDrag);
    // this.canvasDiv.removeEventListener('dragover',this.onDrag);
    // this.input.removeEventListener('change',this.setInputData);
  }

  public onkeyboardEvent(event:KeyboardEvent):void{
    this.controllerL.setKeyState(event.code,event.type==='keydown'?true:false);
    this.controllerR.setKeyState(event.code,event.type==='keydown'?true:false);
  }

  //控制器监听
  public addControllerEvent():void{
    window.addEventListener('keydown',this.onkeyboardEvent);
    window.addEventListener('keyup',this.onkeyboardEvent);
  }
  public removeControllerEvent():void{
    window.removeEventListener('keydown',this.onkeyboardEvent);
    window.removeEventListener('keyup',this.onkeyboardEvent);
  }

  //销毁
  public dispose():void{
    //
  }
}