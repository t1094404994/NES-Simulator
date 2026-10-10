import { Cpu } from './cpu';
import { CpuBus } from './cpuBus';
import {CartridgeReader} from './cartridge';
import { Ppu } from './ppu';
import { PpuBus } from './ppuBus';
import { Controller } from './controller';
import { Apu ,SAMPLE_PER_FRAME,SAMPLE_PER_SEC} from './apu';
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
  //音频上下文 + 环形缓冲（由 ScriptProcessor 拉取，避免原地改正在播放的 AudioBuffer）
  private audio:AudioContext;
  private audioRing:Float32Array;
  private audioWritePos:number;
  private audioReadPos:number;
  private audioBuffered:number;
  private scriptNode:ScriptProcessorNode;
  private gainNode:GainNode;
  private dcPrevIn:number;
  private dcPrevOut:number;
  private onAudioProcessBound:(e:AudioProcessingEvent)=>void;

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
  public isPause:boolean;

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
    this.onAudioProcessBound=this.onAudioProcess.bind(this);
    this.audioWritePos=0;
    this.audioReadPos=0;
    this.audioBuffered=0;
    this.dcPrevIn=0;
    this.dcPrevOut=0;
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
      if ((this.ppu.scanline === 65 || this.ppu.scanline === 130 || this.ppu.scanline === 195 || this.ppu.scanline === 260) && this.ppu.scanline !== laseScanline){
        this.apu.step(this.cpubus.getCpuCycleFrame());
      }
    }
    this.cpu.randerCall();
    //补完并混音，写入环形缓冲供 Web Audio 拉取
    this.apu.finish();
    this.pushAudioFrame();
    this.apu.clearSqe();
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
        //可以调10帧
        let maxStep=10;
        while(nowTime>this.nextLogicTime&&maxStep--){
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
    this.initAudio();
    this.enterFrame();
  }

  //暂停
  public puase():void{
    this.isPause=true;
    //不重置，则从暂停恢复后就会运行暂停时间内的代码
    this.nextLogicTime=0;
    this.nextRenderTime=0;
    if(this.audio&&this.audio.state==='running'){
      void this.audio.suspend();
    }
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


  //初始化音频：环形缓冲 + ScriptProcessor 拉取
  private initAudio():void{
    const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    if(!Ctx){
      return;
    }
    if(!this.audio){
      // 尽量用 44100，与 APU 采样率一致，减少重采样伪影
      try{
        this.audio=new Ctx({sampleRate:SAMPLE_PER_SEC});
      }catch{
        this.audio=new Ctx();
      }
    }
    const ringLen=SAMPLE_PER_SEC*2;
    if(!this.audioRing||this.audioRing.length!==ringLen){
      this.audioRing=new Float32Array(ringLen);
    }else{
      this.audioRing.fill(0);
    }
    this.audioWritePos=0;
    this.audioReadPos=0;
    this.audioBuffered=0;
    this.dcPrevIn=0;
    this.dcPrevOut=0;

    if(!this.scriptNode){
      // 2048 samples ≈ 46ms @44.1k，平衡延迟与欠载
      this.scriptNode=this.audio.createScriptProcessor(2048,0,1);
      this.scriptNode.onaudioprocess=this.onAudioProcessBound;
      this.gainNode=this.audio.createGain();
      this.gainNode.gain.value=0.85;
      this.scriptNode.connect(this.gainNode);
      this.gainNode.connect(this.audio.destination);
    }
    if(this.audio.state==='suspended'){
      void this.audio.resume();
    }
  }

  // 一帧混音结果写入环形缓冲（带简单 DC blocker；必要时重采样到 AudioContext 采样率）
  private pushAudioFrame():void{
    if(!this.audioRing){
      return;
    }
    const ring=this.audioRing;
    const ringLen=ring.length;
    const srcLen=SAMPLE_PER_FRAME|0;
    const srcRate=SAMPLE_PER_SEC;
    const dstRate=this.audio?this.audio.sampleRate:srcRate;
    const outLen=dstRate===srcRate?srcLen:Math.round(srcLen*dstRate/srcRate);

    for(let i=0;i<outLen;i++){
      let s:number;
      if(dstRate===srcRate){
        s=this.apu.seqDataArr[i];
      }else{
        const srcPos=i*srcRate/dstRate;
        const i0=Math.min(srcLen-1,srcPos|0);
        const i1=Math.min(srcLen-1,i0+1);
        const frac=srcPos-i0;
        const a=this.apu.seqDataArr[i0]||0;
        const b=this.apu.seqDataArr[i1]||0;
        s=a*(1-frac)+b*frac;
      }
      if(!Number.isFinite(s)){
        s=0;
      }
      // 一阶高通，去掉 NES 无符号输出的直流偏置，避免爆音/偏置咔哒
      const y=s-this.dcPrevIn+0.996*this.dcPrevOut;
      this.dcPrevIn=s;
      this.dcPrevOut=y;
      if(this.audioBuffered>=ringLen){
        this.audioReadPos=(this.audioReadPos+1)%ringLen;
        this.audioBuffered--;
      }
      ring[this.audioWritePos]=y;
      this.audioWritePos=(this.audioWritePos+1)%ringLen;
      this.audioBuffered++;
    }
  }

  private onAudioProcess(e:AudioProcessingEvent):void{
    const out=e.outputBuffer.getChannelData(0);
    if(!this.audioRing||this.isPause){
      out.fill(0);
      return;
    }
    const ring=this.audioRing;
    const ringLen=ring.length;
    for(let i=0;i<out.length;i++){
      if(this.audioBuffered>0){
        out[i]=ring[this.audioReadPos];
        this.audioReadPos=(this.audioReadPos+1)%ringLen;
        this.audioBuffered--;
      }else{
        // 欠载：输出静音，避免重复旧数据造成“噪声”
        out[i]=0;
      }
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