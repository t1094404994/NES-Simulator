/**
 * npx tsx scripts/diag-rom.ts source/dq-cn.nes 400
 */
import {readFileSync} from 'fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CartridgeReader} from '../src/cartridge.ts';
import {Cpu} from '../src/cpu.ts';
import {CpuBus} from '../src/cpuBus.ts';
import {Ppu} from '../src/ppu.ts';
import {PpuBus} from '../src/ppuBus.ts';
import {Apu} from '../src/apu.ts';
import {Controller} from '../src/controller.ts';

function frameStats(ppu:Ppu):{nonBd:number;bd:string}{
  let nonBd=0;
  const br=ppu.frameDataView.getUint8(0);
  const bg=ppu.frameDataView.getUint8(1);
  const bb=ppu.frameDataView.getUint8(2);
  for(let i=0;i<256*240;i++){
    const o=i*4;
    if(ppu.frameDataView.getUint8(o)!==br||ppu.frameDataView.getUint8(o+1)!==bg||ppu.frameDataView.getUint8(o+2)!==bb) nonBd++;
  }
  return {nonBd,bd:`${br},${bg},${bb}`};
}

function run(path:string, frames:number):void{
  const buf=readFileSync(path);
  const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  const cart=new CartridgeReader();
  if(!cart.resetData(ab)) throw new Error('bad rom');
  const cpubus=new CpuBus();
  const cpu=new Cpu();
  const ppuBus=new PpuBus();
  const ppu=new Ppu();
  const apu=new Apu();
  const padL=new Controller();
  const padR=new Controller();
  cpu.setCpuBus(cpubus);
  ppu.setCpu(cpu);
  ppu.setPpuBus(ppuBus);
  apu.setCpuBus(cpubus);
  cpubus.setCpu(cpu);
  cpubus.setPpu(ppu);
  cpubus.setApu(apu);
  cpubus.setControllerL(padL);
  cpubus.setControllerR(padR);
  cpubus.setCartridgeReader(cart);
  ppuBus.setCartridgeReader(cart);
  padL.reset(true);padR.reset(false);
  cpu.reset();ppu.reset();apu.reset();ppuBus.reset();

  let latch=0,shift=0,currentFrame=0;
  let irqFire=0;
  const origTry=cpubus.tryIRQ.bind(cpubus);
  cpubus.tryIRQ=():void=>{irqFire++;origTry();};

  const buttonsForFrame=(f:number):number=>{
    if(f<80) return 0;
    const t=(f-80)%20;
    if(t<8) return 1<<0;
    if(t>=12&&t<15 && ((f-80)%60)<20) return 1<<3;
    return 0;
  };
  padL.setStrobe=(data:number):void=>{
    padL.strobe=(data&1)===1;
    if(padL.strobe){latch=buttonsForFrame(currentFrame);shift=latch;}
  };
  padL.getKeyState=():number=>{
    let bit:number;
    if(padL.strobe) bit=latch&1;
    else{bit=shift&1;shift>>=1;}
    return 0x40|bit;
  };

  const m=()=>cart.mapper as unknown as {
    irqEnable:boolean;irqCounter:number;irqLatch:number;bankRegs:number[];
  };

  for(let f=0;f<frames;f++){
    currentFrame=f;
    const irqBefore=irqFire;
    const last=ppu.frameFinished;
    while(ppu.frameFinished===last){
      const prevSl=ppu.scanline;
      ppu.step();ppu.step();ppu.step();
      cpu.step();
      if((ppu.scanline===65||ppu.scanline===130||ppu.scanline===195||ppu.scanline===260)&&ppu.scanline!==prevSl){
        apu.step(cpubus.getCpuCycleFrame());
      }
    }
    cpu.randerCall();apu.finish();apu.clearSqe();
    const st=frameStats(ppu);
    const mm=m();
    if(f>=100&&f<=280){
      console.log(
        `f=${f} mask=${ppu.regMask.getData().toString(16)} nonBd=${st.nonBd} bd=${st.bd} `+
        `irqEn=${mm.irqEnable} cnt=${mm.irqCounter}/${mm.irqLatch} fired+=${irqFire-irqBefore} `+
        `I=${cpu.regSf.getI()} flag=${cpu.irqFlag} prg=${mm.bankRegs[6]},${mm.bankRegs[7]}`
      );
    }
  }
}

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
run(process.argv[2]||path.join(repoRoot, 'source/dq-cn.nes'), Number(process.argv[3]||300));
