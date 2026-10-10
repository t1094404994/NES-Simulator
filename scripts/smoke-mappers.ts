/**
 * 最小 iNES ROM 冒烟：验证 mapper 0/2/3/4/7 的 bank 切换与接口接线。
 * 运行: npx tsx scripts/smoke-mappers.ts
 */
import { CartridgeReader } from '../src/cartridge.ts';
import { NametableType } from '../src/nametableType.ts';
import { Mapper4 } from '../src/mapper/mapper4.ts';

function buildINes(opts:{
  mapper:number;
  prg16k:number;
  chr8k:number;
  mirrorVertical?:boolean;
  fourScreen?:boolean;
  battery?:boolean;
}):ArrayBuffer{
  const prgSize=opts.prg16k*16384;
  const chrSize=opts.chr8k*8192;
  const buf=new ArrayBuffer(16+prgSize+chrSize);
  const v=new DataView(buf);
  // NES\x1a
  v.setUint8(0,0x4e);
  v.setUint8(1,0x45);
  v.setUint8(2,0x53);
  v.setUint8(3,0x1a);
  v.setUint8(4,opts.prg16k);
  v.setUint8(5,opts.chr8k);
  let flags6=(opts.mapper&0x0f)<<4;
  if(opts.mirrorVertical) flags6|=0x01;
  if(opts.battery) flags6|=0x02;
  if(opts.fourScreen) flags6|=0x08;
  v.setUint8(6,flags6);
  v.setUint8(7,(opts.mapper&0xf0));

  // 在每个 16KB PRG bank 开头写入 bank 序号；CHR 每个 8KB 同理
  for(let b=0;b<opts.prg16k;b++){
    v.setUint8(16+b*16384,b);
  }
  for(let b=0;b<opts.chr8k;b++){
    v.setUint8(16+prgSize+b*8192,b+0x40);
  }
  return buf;
}

function assert(cond:boolean,msg:string):void{
  if(!cond) throw new Error(msg);
}

function smokeMapper0():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:0,prg16k:2,chr8k:1,mirrorVertical:true})),'m0 load');
  assert(cart.mapperId===0,'m0 id');
  assert(cart.mapper.nametableMirror===NametableType.VIRTICAL,'m0 mirror V');
  assert(cart.mapper.cpuReadRpg(0x8000)===0,'m0 prg bank0');
  console.log('OK mapper 0');
}

function smokeMapper2():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:2,prg16k:8,chr8k:0})),'m2 load');
  cart.mapper.cpuWriteRpg(0x8000,0x05);
  assert(cart.mapper.cpuReadRpg(0x8000)===5,'m2 switch lo bank');
  // 大 bank 掩码：romNum=8 → mask 7，写入 0x15 应落到 5
  cart.mapper.cpuWriteRpg(0x8000,0x15);
  assert(cart.mapper.cpuReadRpg(0x8000)===5,'m2 bank mask');
  console.log('OK mapper 2');
}

function smokeMapper3():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:3,prg16k:2,chr8k:4})),'m3 load');
  assert(cart.mapper.ppuReadPt(0)===0x40,'m3 chr bank0');
  cart.mapper.cpuWriteRpg(0x8000,2);
  assert(cart.mapper.ppuReadPt(0)===0x42,'m3 chr bank2');
  console.log('OK mapper 3');
}

function smokeMapper4():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:4,prg16k:4,chr8k:4})),'m4 load');
  assert(cart.hasWram(),'m4 has WRAM');
  const m=cart.mapper as Mapper4;
  let irqHits=0;
  m.bindIrq(()=>{irqHits++;});

  // 选 R6，写 PRG bank 1（8KB）；mode0 下 $8000 用 R6
  m.cpuWriteRpg(0x8000,0x06); // select R6, prg mode 0
  m.cpuWriteRpg(0x8001,0x02); // 8KB bank 2 → 在 16KB 编号中对应字节
  // bank 2 * 8KB = offset 0x4000 → 位于第 2 个 16KB 的开头? 
  // 16KB bank index 0 at 0, 1 at 16384. 8KB bank 2 = offset 0x4000 = start of 16KB bank 1
  assert(m.cpuReadRpg(0x8000)===1,'m4 prg R6');

  // mirroring
  m.cpuWriteRpg(0xa000,1);
  assert(m.nametableMirror===NametableType.HORIZONTAL,'m4 mirror H');

  // A12 IRQ: latch=0 → 每次 clock 后 counter=0 且 enable 时触发
  m.cpuWriteRpg(0xc000,0); // latch
  m.cpuWriteRpg(0xc001,0); // reload
  m.cpuWriteRpg(0xe001,0); // enable
  m.notifyA12Rise(); // reload to 0
  m.notifyA12Rise(); // counter 0 → irq
  assert(irqHits>=1,'m4 irq fired');

  // WRAM
  m.cpuWriteAddRom(0x6000,0xab);
  assert(m.cpuReadAddRom(0x6000)===0xab,'m4 wram');
  console.log('OK mapper 4');
}

function smokeMapper7():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:7,prg16k:4,chr8k:0})),'m7 load');
  // 4*16KB = 2*32KB banks
  // 32KB bank1 起点 = 16KB bank2，标记字节为 2
  cart.mapper.cpuWriteRpg(0x8000,0x01);
  assert(cart.mapper.cpuReadRpg(0x8000)===2,'m7 prg bank1');
  cart.mapper.cpuWriteRpg(0x8000,0x10);
  assert(cart.mapper.nametableMirror===NametableType.ONESCREEN_HIGHER,'m7 onescreen hi');
  console.log('OK mapper 7');
}

function smokeFourScreen():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:0,prg16k:1,chr8k:1,fourScreen:true})),'4screen load');
  assert(cart.mapper.nametableMirror===NametableType.FOUR_SCREEN,'four-screen flag');
  console.log('OK four-screen header');
}

function main():void{
  smokeMapper0();
  smokeMapper2();
  smokeMapper3();
  smokeMapper4();
  smokeMapper7();
  smokeFourScreen();
  console.log('All mapper smoke tests passed.');
}

main();
