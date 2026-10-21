//NES的6502CPU模拟

import { CpuBus } from './cpuBus';
//CPU频率
export const CPU_CYCLE_PER_SEC=1789773;
// NTSC 一帧约 29780.5 CPU 周期；取整后由 PPU 帧作为主时钟，不再用无 PPU 的 CPU 追赶补齐
export const CPU_CYCLE_PER_FRAME=29781;
//状态寄存器
//寻址模式
enum AddressMode{
  IMP,IMM,ABS,ZP0,ABX,ABY,ZPX,ZPY,IND,IZX,IZY,REL
}

//操作指令接口
interface Instruction{
  name:string; //指令名称
  addressMode:AddressMode; //指令模式
  cycleCnt:number;//CPU周期
}

export class Cpu{
  //累加寄存器 8bit
  private regA:number;
  //X,Y索引寄存器
  private regX:number;
  private regY:number;
  //栈指针寄存器,指向RAM中栈顶+1 由于栈空间只有256字节 所以也是8bit 这里实现是正着推入栈中
  private regSp:number;
  //栈指针偏移 RAM中第256位起的256字节才是栈空间
  private regSpOffSet:number;
  //状态寄存器, 8bit
  public status=0x20;
  //程序计数器,将要执行的指令(总线)地址 每次执行后自增 16bit
  private regPc:number;
  
  //当前指令需要的操作数的地址 16bit
  private address:number;
  //暂存REL寻址模式后的地址偏移
  private addressRel:number;

  //当前操作码 8bit
  private opcode:number;
  //操作码对应的操作指令
  private opcodeMapTable:Array<Instruction>;
  private handlers:Array<()=>number>;
  //等待循环
  private cyclesWait:number;
  //该帧中当前的cpu周期
  public cycleFrame:number;
  //IRQ计数器 右1变为0则执行IRQ中断
  public irqCounter:number;
  //
  public irqFlag:number;
  //IRQ进程中
  public irqInProcess:number;
  // NMI 挂起：PPU 置位后，在指令边界响应
  public nmiPending:boolean;
  private nmiDelay:number;
  // 变址前地址的高字节，以及是否跨页（SHX/SHY/AHX/TAS）
  private operandHi:number;
  private pageCrossed:boolean;
  // KIL/JAM：CPU 停止取指
  private halted:boolean;
  //测试
  private testCycles=0;
  //CPU循环计数
  private clockCount:number;
  //CUP总线的引用
  public cpuBus:CpuBus;

  //画面刷新率
  public frame:number;
  constructor(){
    this.regSpOffSet=0x100;
    this.cyclesWait=0;
    this.cycleFrame=0;
    this.clockCount=0;
    this.address=0;
    this.addressRel=0;
    this.irqCounter=0;
    this.irqFlag=0;
    this.irqInProcess=0;
    this.nmiPending=false;
    this.nmiDelay=0;
    this.operandHi=0;
    this.pageCrossed=false;
    this.halted=false;
    this.setFrame(60);
    this.initTable();
  }

  public pendingCycles():number{
    return this.halted?0:this.cyclesWait;
  }

  private setBit(bit:number,on:boolean):void{
    if(on) this.status|=1<<bit;
    else this.status&=~(1<<bit);
  }

  private getBit(bit:number):number{
    return (this.status>>bit)&1;
  }

  private setC(on:boolean):void{ this.setBit(0,on); }
  private getC():number{ return this.getBit(0); }
  private setZ(on:boolean):void{ this.setBit(1,on); }
  private getZ():number{ return this.getBit(1); }
  private setI(on:boolean):void{ this.setBit(2,on); }
  private getI():number{ return this.getBit(2); }
  private setD(on:boolean):void{ this.setBit(3,on); }
  private setB(on:boolean):void{ this.setBit(4,on); }
  private setU(on:boolean):void{ this.setBit(5,on); }
  private getU():number{ return this.getBit(5); }
  private setV(on:boolean):void{ this.setBit(6,on); }
  private getV():number{ return this.getBit(6); }
  private setN(on:boolean):void{ this.setBit(7,on); }
  private getN():number{ return this.getBit(7); }
  private getStatus():number{ return this.status&0xff; }
  private setStatus(value:number):void{ this.status=value&0xff; }

  //重置/初始化CPU状态
  public reset():void{
    this.regA=0;
    this.regX=0;
    this.regY=0;
    this.regSp=0xfd;
    //检查是否有RESET中断 小端序
    const loBit:number=this.cpuBus.getValue(0xfffc);
    const hiBit:number=this.cpuBus.getValue(0xfffd);
    this.regPc=hiBit<<8|loBit;
    //设置中断
    this.setI(true);
    this.setU(true);
    this.nmiPending=false;
    this.nmiDelay=0;
    this.halted=false;
    this.irqCounter=0;
    this.irqFlag=0;
    this.irqInProcess=0;
  }

  public setRegSfIrq(value:boolean):void{
    this.setI(value);
  }

  public setCpuBus(_cpuBus:CpuBus):void{
    this.cpuBus=_cpuBus;
  }

  public setFrame(_frame:number):void{
    this.frame=_frame;
    
  }

  //初始化操作指令表
  private initTable():void{
    this.opcodeMapTable=[
      {name:'BRK',addressMode: AddressMode.IMM,cycleCnt: 7},{name:'ORA',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'ORA',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'ASL',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PHP',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'ORA',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'ASL',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ORA',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'ASL',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BPL',addressMode: AddressMode.REL,cycleCnt: 2},{name:'ORA',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ORA',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'ASL',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'CLC',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'ORA',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ORA',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'ASL',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'JSR',addressMode: AddressMode.ABS,cycleCnt: 6},{name:'AND',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: 'BIT',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'AND',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'ROL',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PLP',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'ROL',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'BIT',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'ROL',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BMI',addressMode: AddressMode.REL,cycleCnt: 2},{name:'AND',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'ROL',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'SEC',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'AND',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'ROL',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'RTI',addressMode: AddressMode.IMP,cycleCnt: 6},{name:'EOR',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'EOR',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'LSR',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PHA',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'EOR',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'LSR',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'JMP',addressMode:AddressMode.ABS,cycleCnt:3 },{name: 'EOR',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'LSR',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BVC',addressMode: AddressMode.REL,cycleCnt: 2},{name:'EOR',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'EOR',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'LSR',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'CLI',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'EOR',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'EOR',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'LSR',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'RTS',addressMode: AddressMode.IMP,cycleCnt: 6},{name:'ADC',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'ADC',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'ROR',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PLA',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ADC',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'ROR',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'JMP',addressMode:AddressMode.IND,cycleCnt:5 },{name: 'ADC',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'ROR',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BVS',addressMode: AddressMode.REL,cycleCnt: 2},{name:'ADC',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ADC',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'ROR',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'SEI',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'ADC',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ADC',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'ROR',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'???',addressMode: AddressMode.IMP,cycleCnt: 2},{name:'STA',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},{name: 'STY',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'STA',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'STX',addressMode:AddressMode.ZP0,cycleCnt:3},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'DEY',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'TXA',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'STY',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'STA',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'STX',addressMode:AddressMode.ABS,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4},
      {name:'BCC',addressMode: AddressMode.REL,cycleCnt: 2},{name:'STA',addressMode: AddressMode.IZY,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},{name: 'STY',addressMode:AddressMode.ZPX,cycleCnt:4 },{name: 'STA',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'STX',addressMode:AddressMode.ZPY,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'TYA',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'STA',addressMode:AddressMode.ABY,cycleCnt:5 },{name: 'TXS',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'STA',addressMode:AddressMode.ABX,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5},
      {name:'LDY',addressMode: AddressMode.IMM,cycleCnt: 2},{name:'LDA',addressMode: AddressMode.IZX,cycleCnt:6 },{name: 'LDX',addressMode:AddressMode.IMM,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},{name: 'LDY',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'LDA',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'LDX',addressMode:AddressMode.ZP0,cycleCnt:3},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'TAY',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'LDA',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'TAX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'LDY',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'LDA',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'LDX',addressMode:AddressMode.ABS,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4},
      {name:'BCS',addressMode: AddressMode.REL,cycleCnt: 2},{name:'LDA',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:5},{name: 'LDY',addressMode:AddressMode.ZPX,cycleCnt:4 },{name: 'LDA',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'LDX',addressMode:AddressMode.ZPY,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'CLV',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'LDA',addressMode:AddressMode.ABY,cycleCnt:4 },{name: 'TSX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'LDY',addressMode:AddressMode.ABX,cycleCnt:4 },{name: 'LDA',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'LDX',addressMode:AddressMode.ABY,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4},
      {name:'CPY',addressMode: AddressMode.IMM,cycleCnt: 2},{name:'CMP',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: 'CPY',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'CMP',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'DEC',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'INY',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CMP',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'DEX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CPY',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'CMP',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'DEC',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BNE',addressMode: AddressMode.REL,cycleCnt: 2},{name:'CMP',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'CMP',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'DEC',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'CLD',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CMP',addressMode:AddressMode.ABY,cycleCnt:4 },{name: 'NOP',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'CMP',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'DEC',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'CPX',addressMode: AddressMode.IMM,cycleCnt: 2},{name:'SBC',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: 'CPX',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'SBC',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'INC',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'INX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'SBC',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'NOP',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CPX',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'SBC',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'INC',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BEQ',addressMode: AddressMode.REL,cycleCnt: 2},{name:'SBC',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'SBC',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'INC',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'SED',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'SBC',addressMode:AddressMode.ABY,cycleCnt:4 },{name: 'NOP',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'SBC',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'INC',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},];
    this.defineUnofficial();
  }

  // 非官方操作码：寻址和周期与对应的官方指令对齐
  private defineUnofficial():void{
    const set=(opcode:number,name:string,mode:AddressMode,cycles:number):void=>{
      this.opcodeMapTable[opcode]={name,addressMode:mode,cycleCnt:cycles};
    };
    const rmw=(base:number,name:string):void=>{
      set(base+0x00,name,AddressMode.IZX,8);
      set(base+0x04,name,AddressMode.ZP0,5);
      set(base+0x0c,name,AddressMode.ABS,6);
      set(base+0x10,name,AddressMode.IZY,8);
      set(base+0x14,name,AddressMode.ZPX,6);
      set(base+0x18,name,AddressMode.ABY,7);
      set(base+0x1c,name,AddressMode.ABX,7);
    };
    rmw(0x03,'SLO');
    rmw(0x23,'RLA');
    rmw(0x43,'SRE');
    rmw(0x63,'RRA');
    rmw(0xc3,'DCP');
    rmw(0xe3,'ISC');
    set(0x83,'SAX',AddressMode.IZX,6);
    set(0x87,'SAX',AddressMode.ZP0,3);
    set(0x8f,'SAX',AddressMode.ABS,4);
    set(0x97,'SAX',AddressMode.ZPY,4);
    set(0xa3,'LAX',AddressMode.IZX,6);
    set(0xa7,'LAX',AddressMode.ZP0,3);
    set(0xaf,'LAX',AddressMode.ABS,4);
    set(0xb3,'LAX',AddressMode.IZY,5);
    set(0xb7,'LAX',AddressMode.ZPY,4);
    set(0xbf,'LAX',AddressMode.ABY,4);
    for(const opcode of [0x04,0x44,0x64]) set(opcode,'NOP',AddressMode.ZP0,3);
    for(const opcode of [0x14,0x34,0x54,0x74,0xd4,0xf4]) set(opcode,'NOP',AddressMode.ZPX,4);
    for(const opcode of [0x80,0x82,0x89,0xc2,0xe2]) set(opcode,'NOP',AddressMode.IMM,2);
    for(const opcode of [0x1a,0x3a,0x5a,0x7a,0xda,0xfa]) set(opcode,'NOP',AddressMode.IMP,2);
    set(0x0c,'NOP',AddressMode.ABS,4);
    for(const opcode of [0x1c,0x3c,0x5c,0x7c,0xdc,0xfc]) set(opcode,'NOP',AddressMode.ABX,4);
    set(0x0b,'AAC',AddressMode.IMM,2);
    set(0x2b,'AAC',AddressMode.IMM,2);
    set(0x4b,'ASR',AddressMode.IMM,2);
    set(0x6b,'ARR',AddressMode.IMM,2);
    set(0xab,'ATX',AddressMode.IMM,2);
    set(0xcb,'AXS',AddressMode.IMM,2);
    set(0xeb,'SBC',AddressMode.IMM,2);
    set(0x8b,'ANE',AddressMode.IMM,2);
    set(0x93,'AHX',AddressMode.IZY,6);
    set(0x9f,'AHX',AddressMode.ABY,5);
    set(0x9c,'SHY',AddressMode.ABX,5);
    set(0x9e,'SHX',AddressMode.ABY,5);
    set(0x9b,'TAS',AddressMode.ABY,5);
    set(0xbb,'LAS',AddressMode.ABY,4);
    for(const opcode of [0x02,0x12,0x22,0x32,0x42,0x52,0x62,0x72,0x92,0xb2,0xd2,0xf2]){
      set(opcode,'KIL',AddressMode.IMP,2);
    }
    this.bindHandlers();
  }

  private bindHandlers():void{
    const byName:Record<string,()=>number>={
      ADC:()=>this.ADC(),
      AND:()=>this.AND(),
      ASL:()=>this.ASL(),
      BCC:()=>this.BCC(),
      BCS:()=>this.BCS(),
      BEQ:()=>this.BEQ(),
      BIT:()=>this.BIT(),
      BMI:()=>this.BMI(),
      BNE:()=>this.BNE(),
      BPL:()=>this.BPL(),
      BRK:()=>this.BRK(),
      BVC:()=>this.BVC(),
      BVS:()=>this.BVS(),
      CLC:()=>this.CLC(),
      CLD:()=>this.CLD(),
      CLI:()=>this.CLI(),
      CLV:()=>this.CLV(),
      CMP:()=>this.CMP(),
      CPX:()=>this.CPX(),
      CPY:()=>this.CPY(),
      DEC:()=>this.DEC(),
      DEX:()=>this.DEX(),
      DEY:()=>this.DEY(),
      EOR:()=>this.EOR(),
      INC:()=>this.INC(),
      INX:()=>this.INX(),
      INY:()=>this.INY(),
      JMP:()=>this.JMP(),
      JSR:()=>this.JSR(),
      LDA:()=>this.LDA(),
      LDX:()=>this.LDX(),
      LDY:()=>this.LDY(),
      LSR:()=>this.LSR(),
      NOP:()=>this.NOP(),
      ORA:()=>this.ORA(),
      PHA:()=>this.PHA(),
      PHP:()=>this.PHP(),
      PLA:()=>this.PLA(),
      PLP:()=>this.PLP(),
      ROL:()=>this.ROL(),
      ROR:()=>this.ROR(),
      RTI:()=>this.RTI(),
      RTS:()=>this.RTS(),
      SBC:()=>this.SBC(),
      SEC:()=>this.SEC(),
      SED:()=>this.SED(),
      SEI:()=>this.SEI(),
      STA:()=>this.STA(),
      STX:()=>this.STX(),
      STY:()=>this.STY(),
      TAX:()=>this.TAX(),
      TAY:()=>this.TAY(),
      TSX:()=>this.TSX(),
      TXA:()=>this.TXA(),
      TXS:()=>this.TXS(),
      TYA:()=>this.TYA(),
      SLO:()=>this.SLO(),
      RLA:()=>this.RLA(),
      SRE:()=>this.SRE(),
      RRA:()=>this.RRA(),
      SAX:()=>this.SAX(),
      LAX:()=>this.LAX(),
      DCP:()=>this.DCP(),
      ISC:()=>this.ISC(),
      AAC:()=>this.AAC(),
      ASR:()=>this.ASR(),
      ARR:()=>this.ARR(),
      ATX:()=>this.ATX(),
      AXS:()=>this.AXS(),
      ANE:()=>this.ANE(),
      AHX:()=>this.AHX(),
      SHY:()=>this.SHY(),
      SHX:()=>this.SHX(),
      TAS:()=>this.TAS(),
      LAS:()=>this.LAS(),
      KIL:()=>{ this.halted=true; return 0; },
      '???':()=>0,
    };
    this.handlers=this.opcodeMapTable.map((instr)=>byName[instr.name]??(()=>0));
  }

  //CPU主循环
  public step():void{
    if(this.halted){
      this.clockCount++;
      return;
    }
    if(this.cyclesWait===0){
      // NMI 优先于 IRQ，在指令边界采样
      if(this.nmiPending){
        if(this.nmiDelay>0){
          this.nmiDelay--;
        }else{
          this.nmiPending=false;
          this.nmi();
          this.cyclesWait--;
          this.clockCount++;
          return;
        }
      }
      // IRQ 处理。I=1 时保持挂起，不能把 cyclesWait 减成负数把 CPU 卡死
      if(this.irqCounter) {
        --this.irqCounter;
        if(this.irqCounter === 0) {
          if(!this.getI()){
            this.irqInProcess =1;
            this.irq();
            this.cyclesWait--;
            this.clockCount++;
            return;
          }
          this.irqFlag=1;
        }
      }
      //根据程序寄存器寄存的地址，读取汇编操作码
      this.opcode=this.cpuBus.getValue(this.regPc++);
      this.setU(true);
      //根据操作码对应的寻址方式，找到操作数的地址
      const instr:Instruction=this.opcodeMapTable[this.opcode];
      const modeCycles:number=this.impAddressMode(instr.addressMode);
      //执行操作码
      const instrCycles:number=this.handlers[this.opcode]();
      //计算这条指令花费的周期
      this.cyclesWait=instr.cycleCnt;
      //跨页的话周期要多加
      if(instrCycles < 0) this.cyclesWait += (-instrCycles);
      else this.cyclesWait += (instrCycles & modeCycles);
      this.setU(true);
      this.testCycles+=this.cyclesWait;
      this.cycleFrame+=this.cyclesWait;
    }
    this.cyclesWait--;
    this.clockCount++;
  }

  //一帧渲染完成后的回调：以 PPU 帧为主时钟，不再无 PPU 追赶 CPU
  public randerCall():void{
    this.cycleFrame=0;
  }

  public requestNmi(delayInstructions=0):void{
    this.nmiPending=true;
    this.nmiDelay=Math.max(this.nmiDelay,delayInstructions);
  }

  //CPU执行可屏蔽中断
  public irq():void{
    // I=1 时保持挂起，等 CLI/PLP/RTI 后再进（勿丢弃）
    if(this.getI()){
      this.irqFlag=1;
      this.irqInProcess=0;
      return;
    }
    this.irqFlag=0;
    this.stackPush(this.regPc >> 8);
    this.stackPush(this.regPc & 0xFF);
    this.stackPush(this.getStatus()|0x20);
    this.setI(true);
    const lo:number=this.cpuBus.getValue(0xFFFE);
    const hi:number=this.cpuBus.getValue(0xFFFF)<<8;
    this.regPc =hi+lo;
    this.cyclesWait += 7;
    this.cycleFrame+=7;
  }

  //CPU执行不可屏蔽中断
  public nmi():void{
    //console.log('CPU执行不可屏蔽中断');
    this.stackPush(this.regPc >> 8);
    this.stackPush(this.regPc & 0xFF);
    // this.setB(false);
    // this.setU(true);
    this.stackPush(this.getStatus()|0x20);
    this.setI(true);
    const lo:number=this.cpuBus.getValue(0xFFFA);
    const hi:number=this.cpuBus.getValue(0xFFFB)<<8;
    this.regPc =hi+lo;
    //有些是8
    this.cyclesWait += 7;
    this.cycleFrame+=7;
  }

  //执行DMA时，CPU会被阻塞513或514个周期
  public dmaSleep():void{
    //console.log('执行DMA');
    if (this.clockCount & 1){
      //奇数周期需要sleep 514个CPU时钟周期
      this.cyclesWait += 514;
      this.cycleFrame+=514;
    }else{
      //偶数周期需要sleep 513个CPU时钟周期
      this.cyclesWait += 513;
      this.cycleFrame+=513;
    }
  }

  //快速恢复TODO 保留接口QuickResume
  public quickResume():number{
    return 0;
  }

  //数据入栈（6502 SP 在 $00–$FF 环形回绕，禁止抛错打断仿真）
  private stackPush(value:number):void{
    this.cpuBus.setValue(this.regSpOffSet+(this.regSp&0xff),value&0xff);
    this.regSp=(this.regSp-1)&0xff;
  }

  //数据出栈
  private stackPop():number{
    this.regSp=(this.regSp+1)&0xff;
    return this.cpuBus.getValue(this.regSpOffSet+this.regSp);
  }

  //寻址模式

  //累加器寻址
  private IMP():number{
    return 0;
  }

  //立即寻址 Immediate Addressing 操作数地址是PC地址
  private IMM():number{
    this.address=this.regPc++;
    return 0;
  }

  //绝对寻址 Absolute Addressing 又称直接寻址 三字节指令
  private ABS():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    this.address|=this.cpuBus.getValue(this.regPc++)<<8;
    return 0;
  }

  //零页绝对寻址 Zero-page Absolute Addressing
  private ZP0():number{
    this.address=this.cpuBus.getValue(this.regPc++)&0xff;
    return 0;
  }

  //绝对X变址 Absolute X Indexed Addressing 绝对寻址加上X寄存器的值
  private ABX():number{
    const lo:number=this.cpuBus.getValue(this.regPc++);
    const hi:number=this.cpuBus.getValue(this.regPc++)<<8;
    this.address=(hi)+lo+this.regX;
    this.operandHi=hi>>8;
    //偏移了X之后如果发生了翻页，则需要多加一个时钟周期
    this.pageCrossed=(hi)!==(this.address & 0xFF00);
    if (this.pageCrossed) return 1;
    else return 0;
  }

  //绝对Y变址 Absolute Y Indexed Addressing
  private ABY():number{
    const lo:number=this.cpuBus.getValue(this.regPc++);
    const hi:number=this.cpuBus.getValue(this.regPc++)<<8;
    this.address=(hi)+lo+this.regY;
    this.operandHi=hi>>8;
    //偏移了Y之后如果发生了翻页，则需要多加一个时钟周期
    this.pageCrossed=(hi)!==(this.address & 0xFF00);
    if (this.pageCrossed) return 1;
    else return 0;
  }

  //零页X变址 Zero-page X Indexed Addressing
  private ZPX():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    this.address+=this.regX;
    //结果在零页 溢出去头
    this.address=this.address&0xff;
    return 0;
  }

  //零页Y变址 Zero-page Y Indexed Addressing
  private ZPY():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    this.address+=this.regY;
    //结果在零页
    this.address=this.address&0xff;
    return 0;
  }

  //间接寻址 Indirect Addressing
  private IND():number{
    let lo:number=this.cpuBus.getValue(this.regPc++);
    lo|= this.cpuBus.getValue(this.regPc++) << 8;
    // 还原6502的BUG
    const hi:number = (lo & 0xFF00) | ((lo+1) & 0x00FF);
    // 读取间接地址
    this.address = this.cpuBus.getValue(lo) | this.cpuBus.getValue(hi) << 8;
    return 0;
  }

  //间接X变址(先取零页地址，再变址X后间接寻址): Pre-indexed Indirect Addressing
  private IZX():number{
    this.address=this.cpuBus.getValue(this.regPc++)+this.regX;
    //取值在零页内
    const lo:number=this.cpuBus.getValue(this.address&0x00FF);
    const hi:number=this.cpuBus.getValue(this.address+1&0x00FF)<<8;
    this.address=hi+lo;
    return 0;
  }

  //间接Y变址(先取零页地址，后变址Y间接寻址): Post-indexed Indirect Addressing
  private IZY():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    const lo:number=this.cpuBus.getValue(this.address);
    //取值在零页内
    const hi:number=this.cpuBus.getValue(this.address+1&0xff)<<8;
    this.operandHi=hi>>8;
    this.address=hi+lo+this.regY;
    //偏移了Y之后如果发生了翻页(regY+lo>=256)，则需要多加一个时钟周期
    this.pageCrossed=(hi) !== (this.address & 0xFF00);
    if (this.pageCrossed) return 1;
    else return 0;
  }

  //相对寻址 Relative Addressing 条件转移指令的跳转步长 取有符号的8bit数值
  private REL():number{
    this.addressRel=this.cpuBus.getValue(this.regPc++);
    //取得有符号的偏移量
    if(this.addressRel&0x80){
      this.addressRel=this.addressRel|0xff00;
    }
    return 0;
  }
  


  //操作指令

  //累加器,存储器,进位标志C相加,结果送累加器A
  private ADC():number{
    //1.先取走addr_res对应的数值
    const operand:number =this.cpuBus.getValue(this.address);
    //2.加法计算，并写入标志位
    const sum:number = (this.regA + operand + this.getC())&0xffff;
    this.setC(sum >= 0x100);
    this.setV(Boolean((this.regA ^ sum) & (operand ^ sum) & 0x80));
    //reg_sf.set_v((~((uint16_t)reg_a ^ (uint16_t)operand) & ((uint16_t)reg_a ^ (uint16_t)sum)) & 0x0080);
    this.setZ((sum & 0xFF) === 0);
    this.setN(Boolean(sum & 0x80));
    this.regA = sum & 0xFF;
    return 1;
  }

  //存储器单元与累加器做与运算
  private AND():number{
    this.regA&=this.cpuBus.getValue(this.address);
    this.setZ(this.regA === 0);
    this.setN(Boolean(this.regA & 0x80));
    return 1;
  }

  //累加器A, 或者存储器单元算术按位左移一位. 最高位移动到C, 最低位0
  private ASL():number{
    if (this.opcodeMapTable[this.opcode].addressMode === AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number = this.regA << 1;
      this.setC(temp >= 0x100);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值
      const operand:number = this.cpuBus.getValue(this.address);
      const temp:number = operand << 1;
      this.setC(temp >= 0x100);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.cpuBus.setValue(this.address,temp & 0x00FF);
    }
    return 0;
  }

  //如果标志位C(arry) = 0[即没进位]则跳转，否则继续
  private BCC():number{
    let cycles_add = 0;
    if (this.getC() === 0){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  //如果标志位C(arry) = 1则跳转，否则继续
  private BCS():number{
    //C=1则进入分支
    let cycles_add = 0;
    if (this.getC() === 1){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  //如果标志位Z=1则跳转，否则继续
  private BEQ():number{
    let cycles_add = 0;
    if (this.getZ() === 1){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  //位测试 - 若 A&M 结果 =0, 那么Z=1 - 若 A&M 结果!=0, 那么Z=0; S = M的第7位 ; V = M的第6位
  private BIT():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.setZ((this.regA & operand) === 0);
    //位移优先级在位操作之上
    this.setV((operand & 1 << 6)!==0);
    this.setN((operand & 1 << 7)!==0);
    return 0;
  }

  //如果标志位S(ign) = 1[即负数]则跳转，否则继续
  private BMI():number{
    let cycles_add = 0;
    if (this.getN() === 1){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  //如果标志位Z(ero) = 0[即不相同]则跳转，否则继续, 
  private BNE():number{
    let cycles_add = 0;
    if (this.getZ() === 0){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  //如果负标志位N = 0(正数)则跳转
  private BPL():number{
    let cycles_add = 0;
    if (this.getN() === 0){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  /**
   * 强制中断, 记录当前PC+1作为返回地址, 以及PS. 跳转到IRQ地址
   * 由于大部分游戏都没有使用该指令, 所以有些模拟器的实现可能有些问题.
   * BRK虽然是单字节指令, 但是会让PC + 2, 所以干脆认为是双字节指令也不错.
   */
  private BRK():number{
    // IMM 寻址已消费 BRK 的填充字节，regPc 现在就是中断返回地址。
    this.stackPush(this.regPc>>8);
    this.stackPush(this.regPc&0xff);
    this.setB(true);
    this.stackPush(this.getStatus());
    this.setB(false);
    this.setI(true);
    //2.从中断地址处获取新的Program Counter值
    const lo8:number= this.cpuBus.getValue(0xFFFE); //小端序
    const hi8:number= this.cpuBus.getValue(0xFFFF);
    this.regPc =(hi8 << 8) + lo8;
    return 0;
  }

  //如果标志位(o)V(erflow) = 0[即没有溢出]则跳转
  private BVC():number{
    let cycles_add = 0;
    if (this.getV() === 0){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  //如果标志位(o)V(erflow) = 1[即溢出]则跳转
  private BVS():number{
    let cycles_add = 0;
    if (this.getV() === 1){
      this.address=(this.regPc+this.addressRel)&0xffff;
      //如果新老PC寄存器值不在同一页上，则增加2个时钟周期，否则增加一个时钟周期
      if ((this.address & 0xFF00) !== (this.regPc & 0xFF00))
        cycles_add = 2;
      else
        cycles_add = 1;
      this.regPc =this.address;
    }
    return -cycles_add;
  }

  //清除进位标志C
  private CLC():number{
    this.setC(false);
    return 0;
  }

  //清除十进制模式标志D 理论上没有使用
  private CLD():number{
    this.setD(false);
    return 0;
  }

  //清除中断禁止标志I,
  private CLI():number{
    this.setI(false);
    this.irqCounter=this.irqFlag<<1;
    return 0;
  }

  //清除溢出标志V
  private CLV():number{
    this.setV(false);
    return 0;
  }

  //比较储存器值与累加器A.
  private CMP():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //模拟8bit无符号运算 即使temp是16bit无符号数字，结果也一样
    const temp=(this.regA -operand)&0xff;
    this.setC(this.regA >= operand);
    this.setZ(temp=== 0);
    this.setN((temp & 0x0080)!==0);
    return 1;
  }

  //比较储存器值与变址寄存器X
  private CPX():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //模拟八位运算
    const temp=(this.regX -operand)&0xff;
    this.setC(this.regX >= operand);
    this.setZ(temp=== 0);
    this.setN((temp & 0x0080)!==0);
    return 0;
  }

  //比较储存器值与变址寄存器Y
  private CPY():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //模拟八位运算
    const temp=(this.regY -operand)&0xff;
    this.setC(this.regY >= operand);
    this.setZ(temp=== 0);
    this.setN((temp & 0x0080)!==0);
    return 0;
  }

  //存储器单元内容-1 可写入的地址
  private DEC():number{
    const operand:number= this.cpuBus.getValue(this.address);
    let res:number = operand - 1;
    res=res&0xff;
    this.cpuBus.setValue(this.address, res);
    this.setZ(res === 0);
    this.setN((res & 0x0080)!==0);
    return 0;
  }

  //变址寄存器X内容-1
  private DEX():number{
    this.regX--;
    //人工补位
    this.regX=this.regX&0xff;
    this.setZ(this.regX===0);
    this.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //变址寄存器Y内容-1
  private DEY():number{
    this.regY--;
    //人工补位
    this.regY=this.regY&0xff;
    this.setZ(this.regY===0);
    this.setN((this.regY & 0x0080)!==0);
    return 0;
  }

  //存储器单元与累加器做或运算
  private EOR():number{
    const operand:number = this.cpuBus.getValue(this.address);
    this.regA = this.regA ^ operand;
    this.setZ(this.regA === 0);
    this.setN((this.regA & 0x0080)!==0);
    return 1;
  }

  //存储器单元内容+1,
  private INC():number{
    const operand:number = this.cpuBus.getValue(this.address);
    let res:number=operand+1;
    //溢出截取
    res=res&0xff;
    this.cpuBus.setValue(this.address,res);
    this.setZ((res & 0x00FF)=== 0);
    this.setN((res & 0x0080)!==0);
    return 0;
  }

  //变址寄存器X内容+1
  private INX():number{
    this.regX++;
    //溢出截取
    this.regX=this.regX&0xff;
    this.setZ(this.regX === 0);
    this.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //变址寄存器Y内容+1
  private INY():number{
    this.regY++;
    //溢出截取
    this.regY=this.regY&0xff;
    this.setZ(this.regY === 0);
    this.setN((this.regY & 0x0080)!==0);
    return 0;
  }

  //无条件跳转
  private JMP():number{
    this.regPc=this.address;
    return 0;
  }

  //跳转至子程序, 记录该条指令最后的地址
  private JSR():number{
    this.regPc--;
    //溢出截取
    this.regPc=this.regPc&0xffff;
    this.stackPush(this.regPc>>8);
    this.stackPush(this.regPc&0xff);
    this.regPc=this.address;
    return 0;
  }

  //由存储器取数送入累加器A
  private LDA():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regA=operand;
    this.setZ(this.regA === 0);
    this.setN((this.regA & 0x0080)!==0);
    return 1;
  }

  //由存储器取数送入变址寄存器X
  private LDX():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regX=operand;
    this.setZ(this.regX === 0);
    this.setN((this.regX & 0x0080)!==0);
    return 1;
  }

  //由存储器取数送入变址寄存器Y
  private LDY():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regY=operand;
    this.setZ(this.regY === 0);
    this.setN((this.regY & 0x0080)!==0);
    return 1;
  }

  //累加器A, 或者存储器单元逻辑按位右移一位. 最低位回移进C, 最高位变0, 
  private LSR():number{
    if (this.opcodeMapTable[this.opcode].addressMode ===AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number = this.regA >> 1;
      this.setC((this.regA & 0x0001)!==0);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值，最后再写回去
      const operand:number = this.cpuBus.getValue(this.address);
      const temp:number = operand >> 1;
      this.setC((operand & 0x0001)!==0);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.cpuBus.setValue(this.address,temp);
    }
    return 0;
  }

  //空指令
  private NOP():number{
    switch (this.opcode) {
    case 0x1C:
    case 0x3C:
    case 0x5C:
    case 0x7C:
    case 0xDC:
    case 0xFC:
      return 1;
    default:
      return 0;
    }
  }

  //存储器单元与累加器做或运算
  private ORA():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regA=operand|this.regA;
    this.setZ(this.regA === 0);
    this.setN((this.regA & 0x0080)!==0);
    return 1;
  }

  //累加器A压入栈顶
  private PHA():number{
    this.stackPush(this.regA);
    return 0;
  }

  //将状态FLAG压入栈顶,
  private PHP():number{
    const sfData:number=this.getStatus();
    this.stackPush(sfData|1<<4|1<<5);
    this.setB(false);
    this.setU(false);
    return 0;
  }

  //将栈顶给累加器A
  private PLA():number{
    this.regA=this.stackPop();
    this.setZ(this.regA === 0);
    this.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //将栈顶给Status寄存器中
  private PLP():number{
    this.setStatus(this.stackPop());
    this.setU(true);
    this.setB(false);
    if(!this.getI()){
      this.irqCounter=this.irqFlag<<1;
    }
    return 0;
  }

  //累加器A, 或者储存器内容 连同C位 按位循环左移一位 实际上等于做16位运算
  private ROL():number{
    if (this.opcodeMapTable[this.opcode].addressMode ===AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number= this.regA<< 1 | this.getC(); //ROL是循环左移操作，会将C标志位放到循环左移结果的最后一位
      this.setC(temp >= 0x100);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值，最后再写回去
      const operand:number=this.cpuBus.getValue(this.address);
      const temp:number=operand << 1 |this.getC();
      this.setC(temp >= 0x100);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.cpuBus.setValue(this.address, temp & 0x00FF);
    }
    return 0;
  }

  //累加器A, 或者储存器内容 连同C位 按位循环右移一位
  private ROR():number{
    if (this.opcodeMapTable[this.opcode].addressMode ===AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number= this.regA>> 1 | this.getC()<< 7; //ROR是循环右移操作，会将C标志位放到循环右移结果的第一位
      this.setC((this.regA&1)!==0);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值，最后再写回去
      const operand:number=this.cpuBus.getValue(this.address);
      const temp:number=operand >> 1 |this.getC()<< 7;
      this.setC((operand&1)!==0);
      this.setZ((temp & 0x00FF) === 0);
      this.setN((temp & 0x80)!==0);
      this.cpuBus.setValue(this.address, temp & 0x00FF);
    }
    return 0;
  }

  //从中断返回
  private RTI():number{
    this.setStatus(this.stackPop());
    this.setB(false);
    this.setU(true);
    const lo:number=this.stackPop();
    const hi:number=this.stackPop()<<8;
    this.regPc=hi+lo;
    this.irqInProcess=0;
    // 若 IRQ 仍挂起且 I 已清，在下一条指令边界进入
    if(this.irqFlag&&!this.getI()){
      this.irqCounter=1;
    }
    return 0;
  }

  //JSR逆操作, 从子程序返回. 返回之前记录的位置+1
  private RTS():number{
    const lo:number=this.stackPop();
    const hi:number=this.stackPop()<<8;
    this.regPc=hi+lo;
    this.regPc++;
    return 0;
  }

  //从累加器减去存储器和进位标志C,结果送累加器A
  private SBC():number{
    const operand:number= this.cpuBus.getValue(this.address);
    const c:number=!this.getC()?1:0;
    const sub:number= (this.regA - operand -c)&0xffff;
    this.setC(!(sub & 0x100));
    this.setV(((this.regA ^ sub) & ((~operand) ^ sub) & 0x80)!==0);
    this.setZ((sub&0xff)===0);
    this.setN((sub & 0x80)!==0);
    this.regA = sub & 0xff;
    return 1;
  }

  //设置进位标志C
  private SEC():number{
    this.setC(true);
    return 0;
  }

  //设置十进制模式标志D
  private SED():number{
    this.setD(true);
    return 0;
  }

  //设置中断禁止标志I
  private SEI():number{
    this.setI(true);
    return 0;
  }

  //将累加器A的数送入存储器
  private STA():number{
    this.cpuBus.setValue(this.address,this.regA);
    return 0;
  }

  //将变址寄存器X的数送入存储器
  private STX():number{
    this.cpuBus.setValue(this.address,this.regX);
    return 0;
  }

  //将变址寄存器Y的数送入存储器
  private STY():number{
    this.cpuBus.setValue(this.address,this.regY);
    return 0;
  }

  //将累加器A的内容送入变址寄存器X
  private TAX():number{
    this.regX=this.regA;
    this.setZ(this.regX===0);
    this.setN((this.regX&0x80)!==0);
    return 0;
  }

  //将累加器A的内容送入变址寄存器Y
  private TAY():number{
    this.regY=this.regA;
    this.setZ(this.regY===0);
    this.setN((this.regY&0x80)!==0);
    return 0;
  }

  //将栈指针SP内容送入变址寄存器X
  private TSX():number{
    this.regX=this.regSp;
    this.setZ(this.regX===0);
    this.setN((this.regX&0x80)!==0);
    return 0;
  }

  //将变址寄存器X的内容送入累加器A
  private TXA():number{
    this.regA=this.regX;
    this.setZ(this.regA===0);
    this.setN((this.regA&0x80)!==0);
    return 0;
  }

  //将变址寄存器X内容送入栈指针SP
  private TXS():number{
    this.regSp=this.regX;
    return 0;
  }

  //将变址寄存器Y的内容送入累加器A
  private TYA():number{
    this.regA=this.regY;
    this.setZ(this.regA===0);
    this.setN((this.regA&0x80)!==0);
    return 0;
  }

  //执行寻址
  private impAddressMode(mode:AddressMode):number{
    //console.log('开始执行寻址:'+mode);
    switch(mode){
    case AddressMode.IMP:
      return this.IMP();
    case AddressMode.IMM:
      return this.IMM();
    case AddressMode.ABS:
      return this.ABS();
    case AddressMode.ZP0:
      return this.ZP0();
    case AddressMode.ABX:
      return this.ABX();
    case AddressMode.ABY:
      return this.ABY();
    case AddressMode.ZPX:
      return this.ZPX();
    case AddressMode.ZPY:
      return this.ZPY();
    case AddressMode.IND:
      return this.IND();
    case AddressMode.IZX:
      return this.IZX();
    case AddressMode.IZY:
      return this.IZY();
    case AddressMode.REL:
      return this.REL();
    default:
      console.warn('不存在的寻址模式');
      return 0;
    }
  }

  private setZN(value:number):void{
    this.setZ((value&0xff)===0);
    this.setN((value&0x80)!==0);
  }

  // ASL 后 ORA
  private SLO():number{
    const operand:number=this.cpuBus.getValue(this.address);
    const shifted:number=operand<<1;
    this.cpuBus.setValue(this.address,shifted&0xff);
    this.setC(shifted>0xff);
    this.regA=(this.regA|(shifted&0xff))&0xff;
    this.setZN(this.regA);
    return 0;
  }

  // ROL 后 AND
  private RLA():number{
    const operand:number=this.cpuBus.getValue(this.address);
    const shifted:number=(operand<<1)|this.getC();
    this.cpuBus.setValue(this.address,shifted&0xff);
    this.setC((shifted&0x100)!==0);
    this.regA=this.regA&(shifted&0xff);
    this.setZN(this.regA);
    return 0;
  }

  // LSR 后 EOR
  private SRE():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.setC((operand&1)!==0);
    const shifted:number=operand>>1;
    this.cpuBus.setValue(this.address,shifted);
    this.regA=(this.regA^shifted)&0xff;
    this.setZN(this.regA);
    return 0;
  }

  // ROR 后 ADC
  private RRA():number{
    const operand:number=this.cpuBus.getValue(this.address);
    const shifted:number=(operand>>1)|(this.getC()<<7);
    this.cpuBus.setValue(this.address,shifted&0xff);
    this.setC((operand&1)!==0);
    this.ADC();
    return 0;
  }

  // 写入 A & X，不影响标志
  private SAX():number{
    this.cpuBus.setValue(this.address,this.regA&this.regX);
    return 0;
  }

  // LDA 后 TAX
  private LAX():number{
    this.regA=this.cpuBus.getValue(this.address);
    this.regX=this.regA;
    this.setZN(this.regA);
    return 1;
  }

  // DEC 后 CMP
  private DCP():number{
    const operand:number=(this.cpuBus.getValue(this.address)-1)&0xff;
    this.cpuBus.setValue(this.address,operand);
    const diff:number=(this.regA-operand)&0xffff;
    this.setC((diff&0x100)===0);
    this.setZN(diff);
    return 0;
  }

  // INC 后 SBC
  private ISC():number{
    const operand:number=(this.cpuBus.getValue(this.address)+1)&0xff;
    this.cpuBus.setValue(this.address,operand);
    this.SBC();
    return 0;
  }

  // AND 后把 N 复制到 C
  private AAC():number{
    this.regA&=this.cpuBus.getValue(this.address);
    this.setZN(this.regA);
    this.setC((this.regA&0x80)!==0);
    return 0;
  }

  // AND 后 LSR
  private ASR():number{
    this.regA&=this.cpuBus.getValue(this.address);
    this.setC((this.regA&1)!==0);
    this.regA>>=1;
    this.setZN(this.regA);
    return 0;
  }

  // AND 后 ROR，C=结果 bit6，V=bit6 xor bit5
  private ARR():number{
    const value:number=this.regA&this.cpuBus.getValue(this.address);
    const result:number=(value>>1)|(this.getC()<<7);
    this.regA=result&0xff;
    this.setZN(this.regA);
    this.setC((result&0x40)!==0);
    this.setV(((result>>6)&1)!==((result>>5)&1));
    return 0;
  }

  // 立即数同时写入 A 和 X。instr_test-v5 按这条稳定行为校验
  private ATX():number{
    this.regA=this.cpuBus.getValue(this.address);
    this.regX=this.regA;
    this.setZN(this.regA);
    return 0;
  }

  // X = (A & X) - #imm，标志同 CMP
  private AXS():number{
    const operand:number=this.cpuBus.getValue(this.address);
    const value:number=(this.regA&this.regX)-operand;
    this.regX=value&0xff;
    this.setC((value&0x100)===0);
    this.setZN(this.regX);
    return 0;
  }

  // (A | $EE) & X & #imm → A
  private ANE():number{
    this.regA=(this.regA|0xee)&this.regX&this.cpuBus.getValue(this.address);
    this.setZN(this.regA);
    return 0;
  }

  // 不稳定存储：值与 (地址高字节+1) 相与；跨页时地址高字节也被改写
  private storeUnstable(value:number):void{
    let addrHigh:number=(this.address>>8)&0xff;
    const addrLow:number=this.address&0xff;
    if(this.pageCrossed){
      addrHigh&=value;
    }
    const stored:number=value&((this.operandHi+1)&0xff);
    this.cpuBus.setValue((addrHigh<<8)|addrLow,stored);
  }

  private AHX():number{
    this.storeUnstable(this.regA&this.regX);
    return 0;
  }

  private SHY():number{
    this.storeUnstable(this.regY);
    return 0;
  }

  private SHX():number{
    this.storeUnstable(this.regX);
    return 0;
  }

  private TAS():number{
    this.regSp=this.regA&this.regX;
    this.storeUnstable(this.regSp);
    return 0;
  }

  // A = X = SP = 内存 & SP
  private LAS():number{
    const value:number=this.cpuBus.getValue(this.address)&this.regSp;
    this.regA=value;
    this.regX=value;
    this.regSp=value;
    this.setZN(value);
    return 1;
  }

  /** 
   * NES内存映射
   * Address range	Size	Device
    $0000-$07FF	$0800	2KB internal RAM
    $0800-$0FFF	$0800	Mirrors of $0000-$07FF
    $1000-$17FF	$0800
    $1800-$1FFF	$0800
    $2000-$2007	$0008	NES PPU registers
    $2008-$3FFF	$1FF8	Mirrors of $2000-2007 (repeats every 8 bytes)
    $4000-$4017	$0018	NES APU and I/O registers
    $4018-$401F	$0008	APU and I/O functionality that is normally disabled. See CPU Test Mode.
    $4020-$FFFF	$BFE0	Cartridge space: PRG ROM, PRG RAM, and mapper registers (See Note)
   */
}