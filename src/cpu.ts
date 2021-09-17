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

//操作模式
enum AddressMode{
  IMP
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
  //操作码对应的操作,寻址函数表
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

  //CPU主循环
  public step():void{
    if(this.cyclesWait===0){
      //根据程序寄存器寄存的地址，读取汇编操作码
      this.opcode=this.cpuBus.getValue(this.regPc++);
      this.regSf.setU(true);
      //根据操作码对应的寻址方式，找到操作数的地址

      //执行操作码
      this.regSf.setU(true);
    }
    this.cyclesWait--;
    this.clockCount--;
  }

  //数据入栈
  public stackPush(value:number):void{
    if(this.regSp===0){
      throw new Error('栈溢出');
    }
    this.cpuBus.setValue(this.regSp+this.regSpOffSet,value);
    this.regSp--;
  }

  //数据出栈
  public stackPop():number{
    if(this.regSp===0xff){
      console.warn('空栈');
      return 0;
    }
    this.regSp++;
    this.cpuBus.getValue(this.regSp+this.regSpOffSet);
  }

  //寻址模式

  //累加器寻址
  public IMP():number{
    return 0;
  }

  //立即寻址 Immediate Addressing 操作数地址是PC地址
  public IMM():number{
    this.address=this.regPc++;
    return 0;
  }

  //绝对寻址 Absolute Addressing 又称直接寻址 三字节指令
  public ABS():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    this.address|=this.cpuBus.getValue(this.regPc++)<<8;
    return 0;
  }

  //零页绝对寻址 Zero-page Absolute Addressing
  public ABZ():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    return 0;
  }

  //绝对X变址 Absolute X Indexed Addressing 绝对寻址加上X寄存器的值
  public ABX():number{
    const lo:number=this.cpuBus.getValue(this.regPc++);
    const hi:number=this.cpuBus.getValue(this.regPc++)<<8;
    this.address=(hi)+lo+this.regX;
    //偏移了X之后如果发生了翻页，则需要多加一个时钟周期
    if ((hi)!==(this.address & 0xFF00)) return 1;
    else return 0;
  }

  //绝对Y变址 Absolute Y Indexed Addressing
  public ABY():number{
    const lo:number=this.cpuBus.getValue(this.regPc++);
    const hi:number=this.cpuBus.getValue(this.regPc++)<<8;
    this.address=(hi)+lo+this.regY;
    //偏移了X之后如果发生了翻页，则需要多加一个时钟周期
    if ((hi)!==(this.address & 0xFF00)) return 1;
    else return 0;
  }

  //零页X变址 Zero-page X Indexed Addressing
  public ZXIA():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    this.address+=this.regX;
    //结果在零页 溢出去头
    this.address=this.address&0xff;
    return 0;
  }

  //零页Y变址 Zero-page Y Indexed Addressing
  public ZYIA():number{
    this.address=this.cpuBus.getValue(this.regPc++);
    this.address+=this.regY;
    //结果在零页
    this.address=this.address&0xff;
    return 0;
  }

  //间接寻址 Indirect Addressing
  public IND():number{
    let lo:number=this.cpuBus.getValue(this.regPc++);
    lo|= this.cpuBus.getValue(this.regPc++) << 8;
    // 还原6502的BUG
    const hi:number = (lo & 0xFF00) | ((lo+1) & 0x00FF);
    // 读取间接地址
    this.address = this.cpuBus.getValue(lo) | this.cpuBus.getValue(hi) << 8;
    return 0;
  }

  //间接X变址(先取零页地址，再变址X后间接寻址): Pre-indexed Indirect Addressing
  public PRE():number{
    this.address=this.cpuBus.getValue(this.regPc++)+this.regX;
    //取值在零页内
    const lo:number=this.cpuBus.getValue(this.address&0x00FF);
    const hi:number=this.cpuBus.getValue(this.address+1&0x00FF)<<8;
    this.address=hi+lo;
    return 0;
  }

  //间接Y变址(先取零页地址，后变址Y间接寻址): Post-indexed Indirect Addressing
  public POS():number{
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
  public REL():number{
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
  public ADC():number{
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
  public AND():number{
    this.regA&=this.cpuBus.getValue(this.address);
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN(Boolean(this.regA & 0x80));
    return 0;
  }

  //累加器A, 或者存储器单元算术按位左移一位. 最高位移动到C, 最低位0
  public ASL():number{
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
  public BCC():number{
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
  public BCS():number{
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
  public BEQ():number{
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
  public BIT():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regSf.setZ((this.regA & operand) === 0);
    //位移优先级在位操作之上
    this.regSf.setV((operand & 1 << 6)!==0);
    this.regSf.setN((operand & 1 << 7)!==0);
    return 0;
  }

  //如果标志位S(ign) = 1[即负数]则跳转，否则继续
  public BMI():number{
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
  public BNE():number{
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
  public BPL():number{
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
  public BRK():number{
    //1.把Program Counter接下来的指令位置和Status寄存器放到栈里面
    this.regPc++;
    //手动模拟溢出 TODO
    if(this.regPc>0xffff){
      this.regPc=1;
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
  public BVC():number{
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
  public BVS():number{
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
  public CLC():number{
    this.regSf.setC(false);
    return 0;
  }

  //清除十进制模式标志D 理论上没有使用
  public CLD():number{
    this.regSf.setD(false);
    return 0;
  }

  //清除中断禁止标志I,
  public CLI():number{
    this.regSf.setI(false);
    return 0;
  }

  //清除溢出标志V
  public CLV():number{
    this.regSf.setV(false);
    return 0;
  }

  //比较储存器值与累加器A.
  public CMP():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //TODO 与C++类型和运算法则不同
    const temp:number = this.regA -operand;
    this.regSf.setC(this.regA >= operand);
    this.regSf.setZ((temp & 0x00FF) === 0);
    this.regSf.setN((temp & 0x0080)!==0);
    return 0;
  }

  //比较储存器值与变址寄存器X
  public CPX():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //TODO 与C++类型和运算法则不同
    const temp:number = this.regX -operand;
    this.regSf.setC(this.regX >= operand);
    this.regSf.setZ((temp & 0x00FF) === 0);
    this.regSf.setN((temp & 0x0080)!==0);
    return 0;
  }

  //比较储存器值与变址寄存器Y
  public CPY():number{
    const operand:number= this.cpuBus.getValue(this.address);
    //TODO 与C++类型和运算法则不同
    const temp:number = this.regY -operand;
    this.regSf.setC(this.regY >= operand);
    this.regSf.setZ((temp & 0x00FF) === 0);
    this.regSf.setN((temp & 0x0080)!==0);
    return 0;
  }

  //存储器单元内容-1 可写入的地址
  public DEC():number{
    const operand:number= this.cpuBus.getValue(this.address);
    let res:number = operand - 1;
    if(res===-1) res=1;
    this.cpuBus.setValue(this.address, res);
    this.regSf.setZ(res === 0);
    this.regSf.setN((res & 0x0080)!==0);
    return 0;
  }

  //变址寄存器X内容-1
  public DEX():number{
    this.regX--;
    //人工补位
    if(this.regX===-1) this.regX=1;
    this.regSf.setZ(this.regX===0);
    this.regSf.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //变址寄存器Y内容-1
  public DEY():number{
    this.regY--;
    //人工补位
    if(this.regY===-1) this.regY=1;
    this.regSf.setZ(this.regY===0);
    this.regSf.setN((this.regY & 0x0080)!==0);
    return 0;
  }

  //存储器单元与累加器做或运算
  public EOR():number{
    const operand:number = this.cpuBus.getValue(this.address);
    this.regA = this.regA ^ operand;
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //存储器单元内容+1,
  public INC():number{
    const operand:number = this.cpuBus.getValue(this.address);
    let res:number=operand+1;
    //补位 也可能不用
    if(res>0xff) res=1;
    this.cpuBus.setValue(this.address,res);
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //变址寄存器X内容+1
  public INX():number{
    this.regX++;
    //补位 也可能不用
    if(this.regX>0xff) this.regX=1;
    this.regSf.setZ(this.regX === 0);
    this.regSf.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //变址寄存器Y内容+1
  public INY():number{
    this.regY++;
    //补位 也可能不用
    if(this.regY>0xff) this.regY=1;
    this.regSf.setZ(this.regY === 0);
    this.regSf.setN((this.regY & 0x0080)!==0);
    return 0;
  }

  //无条件跳转
  public JMP():number{
    this.regPc=this.address;
    return 0;
  }

  //跳转至子程序, 记录该条指令最后的地址
  public JSR():number{
    this.regPc--;
    //补位 也可能不用
    if(this.regPc===-1) this.regPc=1;
    this.stackPush(this.regPc>>8);
    this.stackPush(this.regPc&0xff);
    this.regPc=this.address;
    return 0;
  }

  //由存储器取数送入累加器A
  public LDA():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regA=operand;
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //由存储器取数送入变址寄存器X
  public LDX():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regX=operand;
    this.regSf.setZ(this.regX === 0);
    this.regSf.setN((this.regX & 0x0080)!==0);
    return 0;
  }

  //由存储器取数送入变址寄存器Y
  public LDY():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regY=operand;
    this.regSf.setZ(this.regY === 0);
    this.regSf.setN((this.regY & 0x0080)!==0);
    return 0;
  }

  //累加器A, 或者存储器单元逻辑按位右移一位. 最低位回移进C, 最高位变0, 
  public LSR():number{
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
  public NOP():number{
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
  public ORA():number{
    const operand:number=this.cpuBus.getValue(this.address);
    this.regA=operand|this.regA;
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //累加器A压入栈顶
  public PHA():number{
    this.stackPush(this.regA);
    return 0;
  }

  //将状态FLAG压入栈顶,
  public PHP():number{
    const sfData:number=this.regSf.getData();
    this.stackPush(sfData|1<<4|1<<5);
    this.regSf.setB(false);
    this.regSf.setU(false);
    return 0;
  }

  //将栈顶给累加器A
  public PLA():number{
    this.regA=this.stackPop();
    this.regSf.setZ(this.regA === 0);
    this.regSf.setN((this.regA & 0x0080)!==0);
    return 0;
  }

  //将栈顶给Status寄存器中
  public PLP():number{
    this.regSf.setData(this.stackPop());
    this.regSf.setU(true);
    return 0;
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