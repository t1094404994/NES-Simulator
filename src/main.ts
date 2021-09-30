import { Cpu } from './cpu';
import { CpuBus } from './cpuBus';
import {CartridgeReader} from './cartridge';
import { Ppu } from './ppu';
import { PpuBus } from './ppuBus';
import { Controller } from './controller';

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
  //控制器
  private controllerL:Controller;
  private controllerR:Controller;
  //画布
  private canvas:HTMLCanvasElement;
  private canvasDiv:HTMLDivElement;
  //上传框
  private inputDiv:HTMLDivElement;
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
    this.controllerL=new Controller();
    this.controllerR=new Controller();
    this.cpu.setCpuBus(this.cpubus);
    this.ppu.setCpu(this.cpu);
    this.ppu.setPpuBus(this.ppuBus);
    this.cpubus.setCpu(this.cpu);
    this.cpubus.setPpu(this.ppu);
    this.cpubus.setControllerL(this.controllerL);
    this.cpubus.setControllerR(this.controllerR);
    this.cartridge=new CartridgeReader();
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
  }

  //设置卡带数据
  public setCartidegData(data:ArrayBuffer):void{
    this.removeControllerEvent();
    this.cartridge.resetData(data);
    this.cpubus.setCartridgeReader(this.cartridge);
    this.ppuBus.setCartridgeReader(this.cartridge);
    this.cpu.reset();
    this.ppu.reset();
    this.ppuBus.reset();
    this.controllerL.reset(true);
    this.controllerR.reset(false);
    this.addControllerEvent();
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
        while(nowTime>this.nextLogicTime){
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
      else if(nowTime>this.nextRenderTime){
        this.nextRenderTime+=1000/this.renderFPS;
        this.drawFrame(this.ppu.frameDataView,256,240);
      }
      // this.step();
      // this.drawFrame(this.ppu.frameDataView,256,240);
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
    console.log('渲染一帧画面');
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

  //移除元素后，移除监听
  public disposeComponent():void{
    this.canvasDiv.removeEventListener('drop',this.onDropover);
    this.canvasDiv.removeEventListener('dragEnter',this.onDrag);
    this.canvasDiv.removeEventListener('dragover',this.onDrag);
    this.input.removeEventListener('change',this.setInputData);
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
//document.body.appendChild(inputComponent());