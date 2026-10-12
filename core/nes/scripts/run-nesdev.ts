/// <reference types="node" />

/**
 * Run a blargg-compatible NESdev test ROM and report its $6000 status protocol.
 * Usage: npx tsx scripts/run-nesdev.ts tests/nesdev/instr_test-v5-all_instrs.nes 3000
 */
import {readFileSync} from 'fs';
import {Apu} from '../src/apu.ts';
import {CartridgeReader} from '../src/cartridge.ts';
import {Controller} from '../src/controller.ts';
import {Cpu} from '../src/cpu.ts';
import {CpuBus} from '../src/cpuBus.ts';
import {Ppu} from '../src/ppu.ts';
import {PpuBus} from '../src/ppuBus.ts';

type TestStatus={complete:boolean;code:number;message:string};

function readStatus(cart:CartridgeReader):TestStatus{
  if(!cart.hasWram()){
    throw new Error('ROM does not expose PRG RAM required by the blargg status protocol');
  }
  const ram=new DataView(cart.mapper.addRam!);
  const signature=ram.getUint8(1)===0xde&&ram.getUint8(2)===0xb0&&ram.getUint8(3)===0x61;
  const code=ram.getUint8(0);
  const complete=signature&&code!==0x80;
  let message='';
  for(let offset=4;offset<ram.byteLength;offset++){
    const value=ram.getUint8(offset);
    if(value===0) break;
    if(value>=0x20&&value<=0x7e) message+=String.fromCharCode(value);
  }
  return {complete,code,message};
}

function run(path:string,maxFrames:number):TestStatus{
  const file=readFileSync(path);
  const data=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const cart=new CartridgeReader();
  if(!cart.resetData(data)) throw new Error('Invalid iNES ROM');

  const cpuBus=new CpuBus();
  const cpu=new Cpu();
  const ppuBus=new PpuBus();
  const ppu=new Ppu();
  const apu=new Apu();
  cpu.setCpuBus(cpuBus);
  ppu.setCpu(cpu);
  ppu.setPpuBus(ppuBus);
  apu.setCpuBus(cpuBus);
  cpuBus.setCpu(cpu);
  cpuBus.setPpu(ppu);
  cpuBus.setApu(apu);
  cpuBus.setControllerL(new Controller());
  cpuBus.setControllerR(new Controller());
  cpuBus.setCartridgeReader(cart);
  ppuBus.setCartridgeReader(cart);
  cpu.reset();
  ppu.reset();
  apu.reset();
  ppuBus.reset();

  if(process.env.NESDEV_TRACE_STATUS==='1'){
    const getStatus=ppu.getStatus.bind(ppu);
    ppu.getStatus=():number=>{
      const timing=ppu as unknown as {nmiDelayDots:number};
      const nmi=cpu as unknown as {nmiDelay:number;nmiPending:boolean};
      const ppuNmiDelay=timing.nmiDelayDots;
      const nmiPending=nmi.nmiPending;
      const nmiDelay=nmi.nmiDelay;
      const value=getStatus();
      console.log(`$2002 read: frame=${ppu.frameDx} scanline=${ppu.scanline} dot=${ppu.cycle} value=$${value.toString(16).padStart(2,'0')} ppuNmi=${ppuNmiDelay} cpuNmi=${nmiPending?1:0}/${nmiDelay}`);
      return value;
    };
  }

  if(process.env.NESDEV_TRACE_MASK==='1'){
    const writeMask=ppu.writeMask.bind(ppu);
    ppu.writeMask=(value:number):void=>{
      console.log(`$2001 write: frame=${ppu.frameDx} scanline=${ppu.scanline} dot=${ppu.cycle} value=$${value.toString(16).padStart(2,'0')}`);
      writeMask(value);
    };
    const stepPpu=ppu.step.bind(ppu);
    ppu.step=():void=>{
      const scanline=ppu.scanline;
      const dot=ppu.cycle;
      stepPpu();
      if(scanline===-1&&ppu.scanline===0){
        console.log(`pre-render end: frame=${ppu.frameDx} dot=${dot} even=${ppu.evenFrame?1:0} mask=$${ppu.regMask.getData().toString(16).padStart(2,'0')}`);
      }
    };
  }

  for(let frame=0;frame<maxFrames;frame++){
    const previousFrame=ppu.frameFinished;
    while(ppu.frameFinished===previousFrame){
      const previousScanline=ppu.scanline;
      ppu.step();
      ppu.step();
      ppu.step();
      cpu.step();
      if((ppu.scanline===65||ppu.scanline===130||ppu.scanline===195||ppu.scanline===260)&&ppu.scanline!==previousScanline){
        apu.step(cpuBus.getCpuCycleFrame());
      }
    }
    const status=readStatus(cart);
    if(status.complete) return status;
    cpu.randerCall();
    apu.finish();
    apu.clearSqe();
  }
  return readStatus(cart);
}

const path=process.argv[2];
const maxFrames=Number(process.argv[3]||3000);
if(!path||!Number.isInteger(maxFrames)||maxFrames<1){
  throw new Error('Usage: npx tsx scripts/run-nesdev.ts <rom.nes> [maxFrames]');
}

const status=run(path,maxFrames);
const result=status.complete?(status.code===0?'PASS':'FAIL'):'TIMEOUT';
console.log(`${result}: code=${status.code}${status.message?` ${status.message}`:''}`);
if(result!=='PASS') process.exitCode=1;