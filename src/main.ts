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
  constructor(){
    this.cpubus=new CpuBus();
    this.cpu=new Cpu();
    this.ppuBus=new PpuBus();
    this.ppu=new Ppu();
    this.cartridge=new CartridgeReader();
    this.canvas=document.createElement('canvas');
    this.setCartidegData=this.setCartidegData.bind(this);
    this.step=this.step.bind(this);
    this.setInputData=this.setInputData.bind(this);
  }

  //设置卡带数据
  public setCartidegData(data:ArrayBuffer):void{
    this.cartridge.resetData(data);
    this.cpubus.init(this.cartridge,this.cpu);
    this.cpu.setCpuBus(this.cpubus);
    this.cpu.reset();
    this.ppu.reset(this.cpu);
    this.ppuBus.reset();
  }

  //主循环
  public step():number{
    const lastFrame=this.ppu.frameFinished;
    //渲染一帧画面
    while(this.ppu.frameFinished > lastFrame)
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
    this.drawFrame(this.ppu.frameDataView,256,240);
    return 0;
  }

  //INPUT组件输入数据
  public setInputData(evt:Event):Promise<string>{
    const target=<HTMLInputElement>evt.currentTarget;
    const file=target.files[0];
    const promise:Promise<string>=new Promise((resolve,reject)=>{
      file.arrayBuffer().then((value:ArrayBuffer)=>{
        this.setCartidegData(value);
        resolve('');
      }).catch(()=>{
        console.warn('文件数据解析时出错');
        reject('');
      });
    });
    return promise;
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
      throw new Error('玩完了，你的浏览器不支持canvas');
    }
    return this.canvas;
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
}
//document.body.appendChild(inputComponent());