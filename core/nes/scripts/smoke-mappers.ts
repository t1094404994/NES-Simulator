/**
 * 最小 iNES ROM 冒烟：验证 mapper 0/2/3/4/7 的 bank 切换与接口接线。
 * 运行: npx tsx scripts/smoke-mappers.ts
 */
import { readFileSync } from 'fs';
import { CartridgeReader } from '../src/cartridge.ts';
import { NametableType } from '../src/nametableType.ts';
import { Mapper4 } from '../src/mapper/mapper4.ts';
import { Nes } from '../src/nes.ts';

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

function smokeMapper4ChrRam():void{
  // 模拟 dq-cn / ff3-cn：mapper4 + 大 PRG + CHR RAM
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:4,prg16k:64,chr8k:0,battery:true})),'m4 chrram load');
  const m=cart.mapper as Mapper4;
  // 默认 CHR mode0：R0 映射 $0000 的 2KB。写入 PPU $0000 应进 banked CHR RAM
  m.cpuWriteRpg(0x8000,0x00);
  m.cpuWriteRpg(0x8001,0x00); // R0 = 0
  m.ppuWritePt(0x0000,0x5a);
  assert(m.ppuReadPt(0x0000)===0x5a,'m4 chrram rw bank0');
  // 换 R0 到 bank 2，同地址应读到不同物理页（初始为 0）
  m.cpuWriteRpg(0x8000,0x00);
  m.cpuWriteRpg(0x8001,0x02);
  assert(m.ppuReadPt(0x0000)!==0x5a,'m4 chrram bank switch');
  m.ppuWritePt(0x0000,0xa5);
  // 切回 bank 0，应仍是 0x5a
  m.cpuWriteRpg(0x8000,0x00);
  m.cpuWriteRpg(0x8001,0x00);
  assert(m.ppuReadPt(0x0000)===0x5a,'m4 chrram bank0 preserved');
  // 1MB PRG：bank 64（8KB）应可访问（不再被 &0x3f 裁掉）
  m.cpuWriteRpg(0x8000,0x06);
  m.cpuWriteRpg(0x8001,64);
  assert(m.cpuReadRpg(0x8000)===32,'m4 prg bank64'); // 8KB bank64 = 16KB index 32
  // 晶科泰 $5000 外层：bit2=1 时 6bit MMC3 bank 映射到高 512KB
  m.cpuWriteExp?.(0x5000,0x04);
  m.cpuWriteRpg(0x8000,0x06);
  m.cpuWriteRpg(0x8001,0x04); // → effective bank 0x44 = 68 → 16KB index 34
  assert(m.cpuReadRpg(0x8000)===34,'m4 prg outer $5000');
  m.cpuWriteExp?.(0x5000,0x00);
  m.cpuWriteRpg(0x8001,0x04); // → bank 4 → 16KB index 2
  assert(m.cpuReadRpg(0x8000)===2,'m4 prg outer clear');
  console.log('OK mapper 4 CHR-RAM + 1MB PRG');
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

function smokeMapper9():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:9,prg16k:4,chr8k:2})),'m9 load');
  cart.mapper.cpuWriteRpg(0xa000,2);
  assert(cart.mapper.cpuReadRpg(0x8000)===1,'m9 prg bank');
  cart.mapper.cpuWriteRpg(0xb000,0);
  cart.mapper.cpuWriteRpg(0xc000,2);
  assert(cart.mapper.ppuReadPt(0)===0x40,'m9 latch fd');
  cart.mapper.ppuReadPt(0x0fe8);
  assert(cart.mapper.ppuReadPt(0)===0x41,'m9 latch fe');
  cart.mapper.cpuWriteRpg(0xf000,1);
  assert(cart.mapper.nametableMirror===NametableType.HORIZONTAL,'m9 mirror');
  console.log('OK mapper 9');
}

function smokeMapper11():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:11,prg16k:4,chr8k:3})),'m11 load');
  cart.mapper.cpuWriteRpg(0x8000,0x12);
  assert(cart.mapper.cpuReadRpg(0x8000)===2,'m11 prg');
  assert(cart.mapper.ppuReadPt(0)===0x42,'m11 chr');
  console.log('OK mapper 11');
}

function smokeMapper16():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:16,prg16k:2,chr8k:2,battery:true})),'m16 load');
  const m=cart.mapper;
  m.cpuWriteRpg(0x8008,1);
  assert(m.cpuReadRpg(0x8000)===1,'m16 prg');
  m.cpuWriteRpg(0x8000,8);
  assert(m.ppuReadPt(0)===0x41,'m16 chr');
  let hits=0;
  m.bindIrq?.(()=>{hits++;});
  m.cpuWriteRpg(0x800b,0);
  m.cpuWriteRpg(0x800c,0);
  m.cpuWriteRpg(0x800a,1);
  m.clockCpu?.();
  assert(hits>=1,'m16 irq');
  const pin=(scl:number,sda:number)=>m.cpuWriteRpg(0x800d,(sda<<6)|(scl<<5));
  const clockByte=(byte:number)=>{
    for(let i=7;i>=0;i--){
      const bit=(byte>>i)&1;
      pin(0,bit);
      pin(1,bit);
    }
    pin(0,1);
    pin(1,1);
  };
  pin(1,1);
  pin(1,0);
  clockByte(0xa0);
  clockByte(3);
  clockByte(0x44);
  pin(0,0);
  pin(1,0);
  pin(1,1);
  const saved=m.exportBattery?.();
  assert(!!saved&&saved.length===256&&saved[3]===0x44,'m16 eeprom write');
  const nes=new Nes();
  assert(nes.loadRom(buildINes({mapper:16,prg16k:2,chr8k:1,battery:true})),'m16 nes');
  assert(nes.hasBattery(),'m16 battery');
  nes.importSave(saved!);
  assert(nes.exportSave()?.[3]===0x44,'m16 import');
  nes.importSave(new Uint8Array(4));
  assert(nes.exportSave()?.[3]===0x44,'m16 import length');
  console.log('OK mapper 16');
}

function smokeMapper23():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:23,prg16k:4,chr8k:1})),'m23 load');
  const m=cart.mapper;
  // A0 取 CPU A1，A1 取 CPU A0：$F000 低位，$F002 高位，$F001 是控制
  m.cpuWriteRpg(0x8000,2);
  assert(m.cpuReadRpg(0x8000)===1,'m23 prg');
  m.cpuWriteRpg(0xf000,0x0f);
  m.cpuWriteRpg(0xf002,0x0f);
  let hits=0;
  m.bindIrq?.(()=>{hits++;});
  m.cpuWriteRpg(0xf001,0x06);
  m.clockCpu?.();
  assert(hits>=1,'m23 irq');
  console.log('OK mapper 23');
}

function smokeMapper25():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:25,prg16k:4,chr8k:2})),'m25 load');
  cart.mapper.cpuWriteRpg(0xb000,8);
  assert(cart.mapper.ppuReadPt(0)===0x41,'m25 chr');
  console.log('OK mapper 25');
}

function smokeMapper33():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:33,prg16k:4,chr8k:2})),'m33 load');
  cart.mapper.cpuWriteRpg(0x8000,2);
  assert(cart.mapper.cpuReadRpg(0x8000)===1,'m33 prg');
  assert(cart.mapper.nametableMirror===NametableType.VIRTICAL,'m33 mirror v');
  cart.mapper.cpuWriteRpg(0x8000,0x40);
  assert(cart.mapper.nametableMirror===NametableType.HORIZONTAL,'m33 mirror h');
  cart.mapper.cpuWriteRpg(0x8002,4);
  assert(cart.mapper.ppuReadPt(0)===0x41,'m33 chr');
  console.log('OK mapper 33');
}

function smokeMapper34():void{
  const bn=new CartridgeReader();
  assert(bn.resetData(buildINes({mapper:34,prg16k:4,chr8k:0})),'m34 bnrom');
  bn.mapper.cpuWriteRpg(0x8000,1);
  assert(bn.mapper.cpuReadRpg(0x8000)===2,'m34 prg');
  const nina=new CartridgeReader();
  assert(nina.resetData(buildINes({mapper:34,prg16k:2,chr8k:2})),'m34 nina');
  nina.mapper.cpuWriteAddRom(0x7ffe,2);
  assert(nina.mapper.ppuReadPt(0)===0x41,'m34 chr');
  console.log('OK mapper 34');
}

function smokeMapper66():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:66,prg16k:8,chr8k:2})),'m66 load');
  cart.mapper.cpuWriteRpg(0x8000,0x21);
  assert(cart.mapper.cpuReadRpg(0x8000)===4,'m66 prg');
  assert(cart.mapper.ppuReadPt(0)===0x41,'m66 chr');
  console.log('OK mapper 66');
}

function smokeMapper69():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:69,prg16k:4,chr8k:2,battery:true})),'m69 load');
  const m=cart.mapper;
  m.cpuWriteRpg(0x8000,9);
  m.cpuWriteRpg(0xa000,2);
  assert(m.cpuReadRpg(0x8000)===1,'m69 prg');
  m.cpuWriteRpg(0x8000,0);
  m.cpuWriteRpg(0xa000,8);
  assert(m.ppuReadPt(0)===0x41,'m69 chr');
  m.cpuWriteRpg(0x8000,8);
  m.cpuWriteRpg(0xa000,0x40);
  m.cpuWriteAddRom(0x6000,0xab);
  assert(m.cpuReadAddRom(0x6000)===0xab,'m69 wram');
  let hits=0;
  m.bindIrq?.(()=>{hits++;});
  m.cpuWriteRpg(0x8000,0x0e);
  m.cpuWriteRpg(0xa000,0);
  m.cpuWriteRpg(0x8000,0x0f);
  m.cpuWriteRpg(0xa000,0);
  m.cpuWriteRpg(0x8000,0x0d);
  m.cpuWriteRpg(0xa000,0x81);
  m.clockCpu?.();
  assert(hits>=1,'m69 irq');
  console.log('OK mapper 69');
}

function smokeMapper71():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:71,prg16k:4,chr8k:0})),'m71 load');
  cart.mapper.cpuWriteRpg(0xc000,1);
  assert(cart.mapper.cpuReadRpg(0x8000)===1,'m71 prg');
  assert(cart.mapper.cpuReadRpg(0xc000)===3,'m71 prg fixed');
  cart.mapper.cpuWriteRpg(0x9000,0x10);
  assert(cart.mapper.nametableMirror===NametableType.ONESCREEN_HIGHER,'m71 mirror');
  console.log('OK mapper 71');
}

function smokeMapper74():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:74,prg16k:4,chr8k:2})),'m74 load');
  const m=cart.mapper;
  m.cpuWriteRpg(0x8000,0);
  m.cpuWriteRpg(0x8001,8);
  m.ppuWritePt(0,0x5a);
  assert(m.ppuReadPt(0)===0x5a,'m74 chrram');
  m.cpuWriteRpg(0x8000,0);
  m.cpuWriteRpg(0x8001,0);
  assert(m.ppuReadPt(0)===0x40,'m74 chrrom');
  m.cpuWriteRpg(0x8000,0);
  m.cpuWriteRpg(0x8001,8);
  assert(m.ppuReadPt(0)===0x5a,'m74 chrram kept');
  console.log('OK mapper 74');
}

function smokeMapper75():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:75,prg16k:4,chr8k:2})),'m75 load');
  cart.mapper.cpuWriteRpg(0x8000,2);
  assert(cart.mapper.cpuReadRpg(0x8000)===1,'m75 prg');
  cart.mapper.cpuWriteRpg(0xe000,2);
  assert(cart.mapper.ppuReadPt(0)===0x41,'m75 chr');
  cart.mapper.cpuWriteRpg(0x9000,1);
  assert(cart.mapper.nametableMirror===NametableType.HORIZONTAL,'m75 mirror');
  console.log('OK mapper 75');
}

function smokeMapper87():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:87,prg16k:2,chr8k:4})),'m87 load');
  cart.mapper.cpuWriteAddRom(0x6000,1);
  assert(cart.mapper.ppuReadPt(0)===0x42,'m87 chr');
  assert(cart.mapper.cpuReadRpg(0x8000)===0,'m87 prg');
  console.log('OK mapper 87');
}

function smokeMapper118():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:118,prg16k:4,chr8k:2,mirrorVertical:true})),'m118 load');
  const m=cart.mapper;
  assert(m.nametableMirror===NametableType.VIRTICAL,'m118 header mirror');
  m.cpuWriteRpg(0xa000,1);
  assert(m.nametableMirror===NametableType.VIRTICAL,'m118 ignore mirror reg');
  m.cpuWriteRpg(0x8000,0);
  m.cpuWriteRpg(0x8001,0x80);
  assert(m.nametableIndex?.(0x2000)===1,'m118 nt bit7');
  assert(m.nametableIndex?.(0x2800)===0,'m118 nt other');
  console.log('OK mapper 118');
}

function smokeMapper140():void{
  const cart=new CartridgeReader();
  assert(cart.resetData(buildINes({mapper:140,prg16k:4,chr8k:2})),'m140 load');
  cart.mapper.cpuWriteAddRom(0x6000,0x11);
  assert(cart.mapper.cpuReadRpg(0x8000)===2,'m140 prg');
  assert(cart.mapper.ppuReadPt(0)===0x41,'m140 chr');
  console.log('OK mapper 140');
}

function smokeBatteryRoundtrip():void{
  const buf=buildINes({mapper:4,prg16k:2,chr8k:1,battery:true});
  const nes=new Nes();
  assert(nes.loadRom(buf),'battery load');
  assert(nes.hasBattery(),'battery flag');
  const bus=(nes as unknown as {cpubus:{setValue(a:number,v:number):void;getValue(a:number):number}}).cpubus;
  let dirty=0;
  nes.onSaveDirty=()=>{dirty+=1;};
  bus.setValue(0x6000,0x5a);
  bus.setValue(0x6000,0x5a);
  bus.setValue(0x6001,0x11);
  assert(dirty===2,'battery dirty on change');
  const saved=nes.exportSave();
  assert(!!saved&&saved[0]===0x5a&&saved[1]===0x11,'battery export');
  const next=new Nes();
  assert(next.loadRom(buf.slice(0)),'battery reload');
  next.importSave(saved!);
  const bus2=(next as unknown as {cpubus:{getValue(a:number):number}}).cpubus;
  assert(bus2.getValue(0x6000)===0x5a,'battery import');
  next.importSave(new Uint8Array(4));
  assert(bus2.getValue(0x6000)===0x5a,'battery reject short');
  const plain=buildINes({mapper:0,prg16k:1,chr8k:1});
  const nrom=new Nes();
  assert(nrom.loadRom(plain),'nrom load');
  assert(!nrom.hasBattery(),'nrom no battery');
  assert(nrom.exportSave()===null,'nrom no export');
  console.log('OK battery roundtrip');
}

function smokeLibraryRoms():void{
  const names=[
    'Jackal.nes',
    'nekketsu-fighting-legend-cn.nes',
    'hudsons-adventure-island-cn.nes',
  ];
  for(const name of names){
    const file=readFileSync(`../../source/${name}`);
    const data=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
    const nes=new Nes();
    assert(nes.loadRom(data),name);
    for(let i=0;i<30;i++) nes.step();
    console.log('OK load',name);
  }
}

function main():void{
  smokeMapper0();
  smokeMapper2();
  smokeMapper3();
  smokeMapper4();
  smokeMapper4ChrRam();
  smokeMapper7();
  smokeFourScreen();
  smokeMapper9();
  smokeMapper11();
  smokeMapper16();
  smokeMapper23();
  smokeMapper25();
  smokeMapper33();
  smokeMapper34();
  smokeMapper66();
  smokeMapper69();
  smokeMapper71();
  smokeMapper74();
  smokeMapper75();
  smokeMapper87();
  smokeMapper118();
  smokeMapper140();
  smokeBatteryRoundtrip();
  smokeLibraryRoms();
  console.log('All mapper smoke tests passed.');
}

main();
