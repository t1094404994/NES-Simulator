//NES的6502CPU模拟

import { CpuBus } from './cpuBus';

//状态寄存器
class StatusFlag{
  private data:number;
  constructor(){
    this.data=1<<5;
  }

  public getData():number{
    return this.data;
  }

  public setData(value:number){
    this.data=value&0xff;
  }

  /**
   * TODO 移动到Math.util里去
   * 把数值某位指定为1或0
   * @param value 被指定的数值
   * @param bit 哪一位
   * @param bool true为1，false为0
   */
  public SpecifieBit(value:number,bit:number,bool:boolean){
    if(bool){
      //加减运算符大于位移，位移大于位与/位或
      value=value|1<<bit;
    }else{
      //按位非跟加减运算符同级
      value=value&~(1<<bit);
    }
  }

  /**
   * 某个数的指定位是否为1
   * @param data 
   * @param bit 
   */
  public getBitVaule(data:number,bit:number):number{
    return data&1<<bit;
  }

  // 进位标记(Carry flag)
  public setC(bool:boolean):void{
    this.SpecifieBit(this.data,0,bool);
  }

  // 零标记 (Zero flag)
  public setZ(bool:boolean):void{
    this.SpecifieBit(this.data,1,bool);
  }

  // 禁止中断(Irq disabled flag)
  public setI(bool:boolean):void{
    this.SpecifieBit(this.data,2,bool);
  }

  //NES没有使用
  // 十进制模式(Decimal mode flag)
  public setD(bool:boolean):void{
    this.SpecifieBit(this.data,3,bool);
  }

  // 软件中断(BRK flag)
  public setB(bool:boolean):void{
    this.SpecifieBit(this.data,4,bool);
  }

  // 保留标记(Reserved) 一直为1
  public setU(bool:boolean):void{
    this.SpecifieBit(this.data,5,bool);
  }

  // 溢出标记(Overflow  flag)
  public setV(bool:boolean):void{
    this.SpecifieBit(this.data,6,bool);
  }

  // 符号标记(Sign flag)
  public setN(bool:boolean):void{
    this.SpecifieBit(this.data,7,bool);
  }

  public getC():number{
    if(this.getBitVaule(this.data,0)) return 1;
    else return 0; 
  }

  public getZ():number{
    if(this.getBitVaule(this.data,1)) return 1;
    else return 0; 
  }

  public getI():number{
    if(this.getBitVaule(this.data,2)) return 1;
    else return 0; 
  }

  public getD():number{
    if(this.getBitVaule(this.data,3)) return 1;
    else return 0; 
  }

  public getB():number{
    if(this.getBitVaule(this.data,4)) return 1;
    else return 0; 
  }

  public getU():number{
    if(this.getBitVaule(this.data,5)) return 1;
    else return 0; 
  }

  public getV():number{
    if(this.getBitVaule(this.data,6)) return 1;
    else return 0; 
  }

  public getN():number{
    if(this.getBitVaule(this.data,7)) return 1;
    else return 0; 
  }
}

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
  private regSf:StatusFlag;
  //程序计数器,将要执行的指令(总线)地址 每次执行后自增 16bit
  private regPc:number;
  
  //当前指令需要的操作数的地址 16bit
  private address:number;

  //当前操作码 8bit
  private opcode:number;
  //操作码对应的操作指令
  private opcodeMapTable:Array<Instruction>;
  //等待循环
  private cyclesWait:number;
  //CPU循环计数
  private clockCount:number;
  //CUP总线的引用
  public cpuBus:CpuBus;

  constructor(bus:CpuBus){
    this.cpuBus=bus;
    this.regSf=new StatusFlag();
    this.regSpOffSet=0x100;
    this.initTable();
    this.reset();
  }

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
    this.regSf.setI(true);
    this.regSf.setU(true);
    console.log('重置/初始化CPU');
  }

  //初始化操作指令表
  private initTable():void{
    this.opcodeMapTable=[{name:'BRK',addressMode: AddressMode.IMM,cycleCnt:7},{name:'ORA',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'ORA',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'ASL',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PHP',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'ORA',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'ASL',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ORA',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'ASL',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BPL',addressMode: AddressMode.REL,cycleCnt: 2},{name:'ORA',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ORA',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'ASL',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'CLC',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'ORA',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ORA',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'ASL',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'JSR',addressMode: AddressMode.ABS,cycleCnt: 6},{name:'AND',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: 'BIT',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'AND',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'ROL',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PLP',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'ROL',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'BIT',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'ROL',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BMI',addressMode: AddressMode.REL,cycleCnt: 2},{name:'AND',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'ROL',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'SEC',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'AND',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'AND',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'ROL',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'RTI',addressMode: AddressMode.IMP,cycleCnt: 6},{name:'EOR',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'EOR',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'LSR',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PHA',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'EOR',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'LSR',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'JMP',addressMode:AddressMode.ABS,cycleCnt:3 },{name: 'EOR',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'LSR',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BVC',addressMode: AddressMode.REL,cycleCnt: 2},{name:'EOR',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'EOR',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'LSR',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'CLI',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'EOR',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'EOR',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'LSR',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'RTS',addressMode: AddressMode.IMP,cycleCnt: 6},{name:'ADC',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'ADC',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'ROR',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'PLA',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ADC',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'ROR',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'JMP',addressMode:AddressMode.IND,cycleCnt:5 },{name: 'ADC',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'ROR',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BVS',addressMode: AddressMode.REL,cycleCnt: 2},{name:'ADC',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ADC',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'ROR',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'SEI',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'ADC',addressMode:AddressMode.ABY,cycleCnt:4 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'ADC',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'ROR',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'???',addressMode: AddressMode.IMP,cycleCnt: 2},{name:'STA',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},{name: 'STY',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'STA',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'STX',addressMode:AddressMode.ZP0,cycleCnt:3},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'DEY',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'TXA',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'STY',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'STA',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'STX',addressMode:AddressMode.ABS,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4},
      {name:'BCC',addressMode: AddressMode.REL,cycleCnt: 2},{name:'STA',addressMode: AddressMode.IZY,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},{name: 'STY',addressMode:AddressMode.ZPX,cycleCnt:4 },{name: 'STA',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'STX',addressMode:AddressMode.ZPY,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'TYA',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'STA',addressMode:AddressMode.ABY,cycleCnt:5 },{name: 'TXS',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'STA',addressMode:AddressMode.ABX,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5},
      {name:'LDY',addressMode: AddressMode.IMM,cycleCnt: 2},{name:'LDA',addressMode: AddressMode.IZX,cycleCnt:6 },{name: 'LDX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},{name: 'LDY',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'LDA',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'LDX',addressMode:AddressMode.ZP0,cycleCnt:3},{name: '???',addressMode:AddressMode.IMP,cycleCnt:3 },{name: 'TAY',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'LDA',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'TAX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'LDY',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'LDA',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'LDX',addressMode:AddressMode.ABS,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4},
      {name:'BCS',addressMode: AddressMode.REL,cycleCnt: 2},{name:'LDA',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:5},{name: 'LDY',addressMode:AddressMode.ZPX,cycleCnt:4 },{name: 'LDA',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'LDX',addressMode:AddressMode.ZPY,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'CLV',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'LDA',addressMode:AddressMode.ABY,cycleCnt:4 },{name: 'TSX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'LDY',addressMode:AddressMode.ABX,cycleCnt:4 },{name: 'LDA',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'LDX',addressMode:AddressMode.ABY,cycleCnt:4},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4},
      {name:'CPY',addressMode: AddressMode.IMM,cycleCnt: 2},{name:'CMP',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: 'CPY',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'CMP',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'DEC',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'INY',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CMP',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'DEX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CPY',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'CMP',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'DEC',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BNE',addressMode: AddressMode.REL,cycleCnt: 2},{name:'CMP',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'CMP',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'DEC',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'CLD',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CMP',addressMode:AddressMode.ABY,cycleCnt:4 },{name: 'NOP',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'CMP',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'DEC',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},
      {name:'CPX',addressMode: AddressMode.IMM,cycleCnt: 2},{name:'SBC',addressMode: AddressMode.IZX,cycleCnt:6 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: 'CPX',addressMode:AddressMode.ZP0,cycleCnt:3 },{name: 'SBC',addressMode:AddressMode.ZP0,cycleCnt:3},{name: 'INC',addressMode:AddressMode.ZP0,cycleCnt:5},{name: '???',addressMode:AddressMode.IMP,cycleCnt:5 },{name: 'INX',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'SBC',addressMode:AddressMode.IMM,cycleCnt:2 },{name: 'NOP',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'CPX',addressMode:AddressMode.ABS,cycleCnt:4 },{name: 'SBC',addressMode:AddressMode.ABS,cycleCnt:4},{name: 'INC',addressMode:AddressMode.ABS,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6},
      {name:'BEQ',addressMode: AddressMode.REL,cycleCnt: 2},{name:'SBC',addressMode: AddressMode.IZY,cycleCnt:5 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:8},{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'SBC',addressMode:AddressMode.ZPX,cycleCnt:4},{name: 'INC',addressMode:AddressMode.ZPX,cycleCnt:6},{name: '???',addressMode:AddressMode.IMP,cycleCnt:6 },{name: 'SED',addressMode:AddressMode.IMP,cycleCnt:2 },{name: 'SBC',addressMode:AddressMode.ABY,cycleCnt:4 },{name: 'NOP',addressMode:AddressMode.IMP,cycleCnt:2 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:7 },{name: '???',addressMode:AddressMode.IMP,cycleCnt:4 },{name: 'SBC',addressMode:AddressMode.ABX,cycleCnt:4},{name: 'INC',addressMode:AddressMode.ABX,cycleCnt:7},{name: '???',addressMode:AddressMode.IMP,cycleCnt:7},];
  }

  //CPU主循环
  public step():void{
    if(this.cyclesWait===0){
      //根据程序寄存器寄存的地址，读取汇编操作码
      this.opcode=this.cpuBus.getValue(this.regPc++);
      this.regSf.setU(true);
      //根据操作码对应的寻址方式，找到操作数的地址
      const instr:Instruction=this.opcodeMapTable[this.opcode];
      const modeCycles:number=this.impAddressMode(instr.addressMode);
      //执行操作码
      const instrCycles:number=this.impInstructions(instr.name);
      //计算这条指令花费的周期
      this.cyclesWait=instr.cycleCnt;
      //跨页的话周期要多加
      if(instrCycles < 0) this.cyclesWait += (-instrCycles);
      else this.cyclesWait += (instrCycles & modeCycles);
      this.regSf.setU(true);
    }
    this.cyclesWait--;
    this.clockCount--;
  }

  //CPU执行可屏蔽中断
  public irq():void{
    console.log('CPU执行可屏蔽中断');
    if (this.regSf.getI() === 0){ //判断中断是否被屏蔽了。0为允许IRQ中断，1为屏蔽
      //把Program Counter和Status寄存器放到栈里面
      this.stackPush(this.regPc >> 8);
      this.stackPush(this.regPc & 0xFF);
      this.stackPush(this.regSf.getData());
      this.regSf.setI(true);
      //TODO
      const lo:number=this.cpuBus.getValue(0xFFFE);
      const hi:number=this.cpuBus.getValue(0xFFFF)<<8;
      this.regPc =hi+lo;
      //IRQ中断需要7个时钟周期
      this.cyclesWait = 7;
    }
  }

  //CPU执行不可屏蔽中断
  public nmi():void{
    console.log('CPU执行不可屏蔽中断');
    this.stackPush(this.regPc >> 8);
    this.stackPush(this.regPc & 0xFF);
    this.regSf.setB(false);
    this.regSf.setU(true);
    this.regSf.setI(true);
    this.stackPush(this.regSf.getData());
    const lo:number=this.cpuBus.getValue(0xFFFE);
    const hi:number=this.cpuBus.getValue(0xFFFF)<<8;
    this.regPc =hi+lo;
    //有些是8
    this.cyclesWait = 7;
  }

  //执行DMA时，CPU会被阻塞513或514个周期
  public dma_sleep():void{
    console.log('执行DMA');
    if (this.clockCount & 1){
      //奇数周期需要sleep 514个CPU时钟周期
      this.cyclesWait += 514;
    }else{
      //偶数周期需要sleep 513个CPU时钟周期
      this.cyclesWait += 513;
    }
  }

  //快速恢复TODO 保留接口QuickResume
  public quickResume():number{
    return 0;
  }

  //数据入栈
  private stackPush(value:number):void{
    if(this.regSp===0){
      throw new Error('栈溢出');
    }
    this.cpuBus.setValue(this.regSp+this.regSpOffSet,value);
    this.regSp--;
  }

  //数据出栈
  private stackPop():number{
    if(this.regSp===0xff){
      console.warn('空栈');
      return 0;
    }
    this.regSp++;
    this.cpuBus.getValue(this.regSp+this.regSpOffSet);
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
    this.address=this.cpuBus.getValue(this.regPc++);
    return 0;
  }

  //绝对X变址 Absolute X Indexed Addressing 绝对寻址加上X寄存器的值
  private ABX():number{
    const lo:number=this.cpuBus.getValue(this.regPc++);
    const hi:number=this.cpuBus.getValue(this.regPc++)<<8;
    this.address=(hi)+lo+this.regX;
    //偏移了X之后如果发生了翻页，则需要多加一个时钟周期
    if ((hi)!==(this.address & 0xFF00)) return 1;
    else return 0;
  }

  //绝对Y变址 Absolute Y Indexed Addressing
  private ABY():number{
    const lo:number=this.cpuBus.getValue(this.regPc++);
    const hi:number=this.cpuBus.getValue(this.regPc++)<<8;
    this.address=(hi)+lo+this.regY;
    //偏移了X之后如果发生了翻页，则需要多加一个时钟周期
    if ((hi)!==(this.address & 0xFF00)) return 1;
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
    this.address=hi+lo+this.regY;
    //偏移了Y之后如果发生了翻页(regY+lo>=256)，则需要多加一个时钟周期
    if ((hi) !== (this.address & 0xFF00)) return 1;
    else return 0;
  }

  //相对寻址 Relative Addressing 条件转移指令的跳转步长 取有符号的8bit数值
  private REL():number{
    const offSet:number=this.cpuBus.getValue(this.regPc++);
    //取得有符号的偏移量
    if(offSet>=0x80){
      this.address=-offSet+0x80+this.regPc;
    }else{
      this.address+=offSet+this.regPc;
    }
    return 0;
  }
  


  //操作指令

  //累加器,存储器,进位标志C相加,结果送累加器A
  private ADC():number{
    //1.先取走addr_res对应的数值
    const operand:number =this.cpuBus.getValue(this.address);
    //2.加法计算，并写入标志位
    const sum:number = this.regA + operand + this.regSf.getC();
    this.regSf.setC(sum >= 0x100);
    this.regSf.setV(Boolean((this.regA ^ sum) & (operand ^ sum) & 0x80));
    //reg_sf.set_v((~((uint16_t)reg_a ^ (uint16_t)operand) & ((uint16_t)reg_a ^ (uint16_t)sum)) & 0x0080);
    this.regSf.setZ((sum & 0xFF) === 0);
    this.regSf.setN(Boolean(sum & 0x80));
    this.regA = sum & 0xFF;
    return 1;
  }

  //存储器单元与累加器做与运算
  private AND():number{
    this.regA&=this.cpuBus.getValue(this.address);
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN(Boolean(this.regA & 0x80));
    return 0;
  }

  //累加器A, 或者存储器单元算术按位左移一位. 最高位移动到C, 最低位0
  private ASL():number{
    if (this.opcodeMapTable[this.opcode].addressMode === AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number = this.regA << 1;
      this.regSf.setC(temp >= 0x100);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值
      const operand:number = this.cpuBus.getValue(this.address);
      const temp:number = operand << 1;
      this.regSf.setC(temp >= 0x100);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
      this.cpuBus.setValue(this.address,temp & 0x00FF);
    }
    return 0;
  }

  //如果标志位C(arry) = 0[即没进位]则跳转，否则继续
  private BCC():number{
    let cycles_add = 0;
    if (this.regSf.getC() === 0){
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
    if (this.regSf.getC() === 1){
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
    if (this.regSf.getZ() === 1){
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
    this.regSf.setZ((this.regA & operand) === 0);
    //位移优先级在位操作之上
    this.regSf.setV((operand & 1 << 6)!==0);
    this.regSf.setN((operand & 1 << 7)!==0);
    return 0;
  }

  //如果标志位S(ign) = 1[即负数]则跳转，否则继续
  private BMI():number{
    let cycles_add = 0;
    if (this.regSf.getN() === 1){
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
    if (this.regSf.getZ() === 0){
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
    if (this.regSf.getN() === 0){
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
    //1.把Program Counter接下来的指令位置和Status寄存器放到栈里面
    this.regPc++;
    //手动模拟溢出
    if(this.regPc>0xffff){
      this.regPc=0;
    }
    //分别把高八位和低八位推入栈
    this.stackPush(this.regPc>>8);
    this.stackPush(this.regPc&0xff);
    this.regSf.setB(true);
    this.regSf.setI(true);
    this.stackPush(this.regSf.getData());
    this.regSf.setB(false);
    //2.从中断地址处获取新的Program Counter值
    const lo8:number= this.cpuBus.getValue(0xFFFE); //小端序
    const hi8:number= this.cpuBus.getValue(0xFFFF);
    this.regPc =(hi8 << 8) + lo8;
    return 0;
  }

  //如果标志位(o)V(erflow) = 0[即没有溢出]则跳转
  private BVC():number{
    let cycles_add = 0;
    if (this.regSf.getV() === 0){
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
    if (this.regSf.getV() === 1){
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
    this.regSf.setC(false);
    return 0;
  }

  //清除十进制模式标志D 理论上没有使用
  private CLD():number{
    this.regSf.setD(false);
    return 0;
  }

  //清除中断禁止标志I,
  private CLI():number{
    this.regSf.setI(false);
    return 0;
  }

  //清除溢出标志V
  private CLV():number{
    this.regSf.setV(false);
    return 0;
  }

  //比较储存器值与累加器A.
  private CMP():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //模拟八位运算
    const temp=(this.regA -operand)&0xff;
    this.regSf.setC(this.regA >= operand);
    this.regSf.setZ(temp=== 0);
    this.regSf.setN((temp & 0x0080)!==0);
    return 0;
  }

  //比较储存器值与变址寄存器X
  private CPX():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //模拟八位运算
    const temp=(this.regX -operand)&0xff;
    this.regSf.setC(this.regX >= operand);
    this.regSf.setZ(temp=== 0);
    this.regSf.setN((temp & 0x0080)!==0);
    return 0;
  }

  //比较储存器值与变址寄存器Y
  private CPY():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //模拟八位运算
    const temp=(this.regY -operand)&0xff;
    this.regSf.setC(this.regY >= operand);
    this.regSf.setZ(temp=== 0);
    this.regSf.setN((temp & 0x0080)!==0);
    return 0;
  }

  //存储器单元内容-1 可写入的地址
  private DEC():number{
    const operand:number= this.cpuBus.getValue(this.address);
    let res:number = operand - 1;
    res=res&0xff;
    this.cpuBus.setValue(this.address, res);
    this.regSf.setZ(res === 0);
    this.regSf.setN((res & 0x0080)!==0);
    return 0;
  }

  //变址寄存器X内容-1
  private DEX():number{
    this.regX--;
    //人工补位
    this.regX=this.regX&0xff;
    this.regSf.setZ(this.regX===0);
    this.regSf.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //变址寄存器Y内容-1
  private DEY():number{
    this.regY--;
    //人工补位
    this.regY=this.regY&0xff;
    this.regSf.setZ(this.regY===0);
    this.regSf.setN((this.regY & 0x0080)!==0);
    return 0;
  }

  //存储器单元与累加器做或运算
  private EOR():number{
    const operand:number = this.cpuBus.getValue(this.address);
    this.regA = this.regA ^ operand;
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //存储器单元内容+1,
  private INC():number{
    const operand:number = this.cpuBus.getValue(this.address);
    let res:number=operand+1;
    //溢出截取
    res=res&0xff;
    this.cpuBus.setValue(this.address,res);
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //变址寄存器X内容+1
  private INX():number{
    this.regX++;
    //溢出截取
    this.regX=this.regX&0xff;
    this.regSf.setZ(this.regX === 0);
    this.regSf.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //变址寄存器Y内容+1
  private INY():number{
    this.regY++;
    //溢出截取
    this.regY=this.regY&0xff;
    this.regSf.setZ(this.regY === 0);
    this.regSf.setN((this.regY & 0x0080)!==0);
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
    this.regPc=this.regPc&0xff;
    this.stackPush(this.regPc>>8);
    this.stackPush(this.regPc&0xff);
    this.regPc=this.address;
    return 0;
  }

  //由存储器取数送入累加器A
  private LDA():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regA=operand;
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //由存储器取数送入变址寄存器X
  private LDX():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regX=operand;
    this.regSf.setZ(this.regX === 0);
    this.regSf.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //由存储器取数送入变址寄存器Y
  private LDY():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regY=operand;
    this.regSf.setZ(this.regY === 0);
    this.regSf.setN((this.regY & 0x0080)!==0);
    return 0;
  }

  //累加器A, 或者存储器单元逻辑按位右移一位. 最低位回移进C, 最高位变0, 
  private LSR():number{
    if (this.opcodeMapTable[this.opcode].addressMode ===AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number = this.regA >> 1;
      this.regSf.setC((this.regA & 0x0001)!==0);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值，最后再写回去
      const operand:number = this.cpuBus.getValue(this.address);
      const temp:number = operand >> 1;
      this.regSf.setC((operand & 0x0001)!==0);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
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
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //累加器A压入栈顶
  private PHA():number{
    this.stackPush(this.regA);
    return 0;
  }

  //将状态FLAG压入栈顶,
  private PHP():number{
    const sfData:number=this.regSf.getData();
    this.stackPush(sfData|1<<4|1<<5);
    this.regSf.setB(false);
    this.regSf.setU(false);
    return 0;
  }

  //将栈顶给累加器A
  private PLA():number{
    this.regA=this.stackPop();
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //将栈顶给Status寄存器中
  private PLP():number{
    this.regSf.setData(this.stackPop());
    this.regSf.setU(true);
    return 0;
  }

  //累加器A, 或者储存器内容 连同C位 按位循环左移一位 实际上等于做16位运算
  private ROL():number{
    if (this.opcodeMapTable[this.opcode].addressMode ===AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number= this.regA<< 1 | this.regSf.getC(); //ROL是循环左移操作，会将C标志位放到循环左移结果的最后一位
      this.regSf.setC(temp >= 0x100);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值，最后再写回去
      const operand:number=this.cpuBus.getValue(this.address);
      const temp:number=operand << 1 |this.regSf.getC();
      this.regSf.setC(temp >= 0x100);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
      this.cpuBus.setValue(this.address, temp & 0x00FF);
    }
    return 0;
  }

  //累加器A, 或者储存器内容 连同C位 按位循环右移一位
  private ROR():number{
    if (this.opcodeMapTable[this.opcode].addressMode ===AddressMode.IMP){
      //IMP(Accumulator)累加器寻址模式下，直接赋值给A寄存器
      const temp:number= this.regA>> 1 | this.regSf.getC()<< 7; //ROR是循环右移操作，会将C标志位放到循环右移结果的第一位
      this.regSf.setC(temp >= 0x100);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
      this.regA = temp & 0x00FF;
    }else{
      //其他模式下，先取走操作符，再对操作符赋值，最后再写回去
      const operand:number=this.cpuBus.getValue(this.address);
      const temp:number=operand >> 1 |this.regSf.getC()<< 7;
      this.regSf.setC(temp >= 0x100);
      this.regSf.setZ((temp & 0x00FF) === 0);
      this.regSf.setN((temp & 0x80)!==0);
      this.cpuBus.setValue(this.address, temp & 0x00FF);
    }
    return 0;
  }

  //从中断返回
  private RTI():number{
    this.regSf.setData(this.stackPop());
    this.regSf.setB(false);
    this.regSf.setU(false);
    const lo:number=this.stackPop();
    const hi:number=this.stackPop()<<8;
    this.regPc=hi+lo;
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
    //1.先取走addr_res对应的数值
    const operand:number= this.cpuBus.getValue(this.address);
    const sub:number= (this.regA - operand - this.regSf.getC())&0xff;
    this.regSf.setC(!(sub & 0x100));
    this.regSf.setV(((this.regA ^ sub) & ((~operand) ^ sub) & 0x80)!==0);
    this.regSf.setZ(sub=== 0);
    this.regSf.setN((sub & 0x80)!==0);
    this.regA = sub & 0x00FF;
    return 1;
  }

  //设置进位标志C
  private SEC():number{
    this.regSf.setC(true);
    return 0;
  }

  //设置十进制模式标志D
  private SED():number{
    this.regSf.setD(true);
    return 0;
  }

  //设置中断禁止标志I
  private SEI():number{
    this.regSf.setI(true);
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
    this.regSf.setZ(this.regX===0);
    this.regSf.setN((this.regX&0x80)!==0);
    return 0;
  }

  //将累加器A的内容送入变址寄存器Y
  private TAY():number{
    this.regY=this.regA;
    this.regSf.setZ(this.regY===0);
    this.regSf.setN((this.regY&0x80)!==0);
    return 0;
  }

  //将栈指针SP内容送入变址寄存器X
  private TSX():number{
    this.regX=this.regSf.getData();
    this.regSf.setZ(this.regX===0);
    this.regSf.setN((this.regX&0x80)!==0);
    return 0;
  }

  //将变址寄存器X的内容送入累加器A
  private TXA():number{
    this.regA=this.regX;
    this.regSf.setZ(this.regA===0);
    this.regSf.setN((this.regA&0x80)!==0);
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
    this.regSf.setZ(this.regA===0);
    this.regSf.setN((this.regA&0x80)!==0);
    return 0;
  }

  //执行寻址
  private impAddressMode(mode:AddressMode):number{
    console.log('开始执行寻址:'+mode);
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

  //执行指令
  private impInstructions(name:string):number{
    console.log('开始执行命令:'+name);
    switch (name) {
    case 'ADC':
      return this.ADC();
    case 'AND':
      return this.AND();
    case 'ASL':
      return this.ASL();
    case 'BCC':
      return this.BCC();
    case 'BCS':
      return this.BCS();
    case 'BEQ':
      return this.BEQ();
    case 'BIT':
      return this.BIT();
    case 'BMI':
      return this.BMI();
    case 'BNE':
      return this.BNE();
    case 'BPL':
      return this.BPL();
    case 'BRK':
      return this.BRK();
    case 'BVC':
      return this.BVC();
    case 'BVS':
      return this.BVS();
    case 'CLC':
      return this.CLC();
    case 'CLD':
      return this.CLD();
    case 'CLI':
      return this.CLI();
    case 'CLV':
      return this.CLV();
    case 'CMP':
      return this.CMP();
    case 'CPX':
      return this.CPX();
    case 'CPY':
      return this.CPY();
    case 'DEC':
      return this.DEC();
    case 'DEX':
      return this.DEX();
    case 'DEY':
      return this.DEY();
    case 'EOR':
      return this.EOR();
    case 'INC':
      return this.INC();
    case 'INX':
      return this.INX();
    case 'INY':
      return this.INY();
    case 'JMP':
      return this.JMP();
    case 'JSR':
      return this.JSR();
    case 'LDA':
      return this.LDA();
    case 'LDX':
      return this.LDX();
    case 'LDY':
      return this.LDY();
    case 'LSR':
      return this.LSR();
    case 'NOP':
      return this.NOP();
    case 'ORA':
      return this.ORA();
    case 'PHA':
      return this.PHA();
    case 'PHP':
      return this.PHP();
    case 'PLA':
      return this.PLA();
    case 'PLP':
      return this.PLP();
    case 'ROL':
      return this.ROL();
    case 'ROR':
      return this.ROR();
    case 'RTI':
      return this.RTI();
    case 'RTS':
      return this.RTS();
    case 'SBC':
      return this.SBC();
    case 'SEC':
      return this.SEC();
    case 'SED':
      return this.SED();
    case 'SEI':
      return this.SEI();
    case 'STA':
      return this.STA();
    case 'STX':
      return this.STX();
    case 'STY':
      return this.STY();
    case 'TAY':
      return this.TAY();
    case 'TSX':
      return this.TSX();
    case 'TXA':
      return this.TXA();
    case 'TXS':
      return this.TXS();
    case 'TYA':
      return this.TYA();
    default:
      throw new Error('未定义的汇编操作');
    }
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