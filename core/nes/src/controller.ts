//NES手柄
export enum NesButton{
  A,
  B,
  SELECT,
  START,
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

/** 主手柄默认键盘映射：J/L、WASD、Q/E */
export const PLAYER1_KEY_MAP:Record<string,NesButton>={
  KeyJ:NesButton.A,
  KeyL:NesButton.B,
  KeyA:NesButton.LEFT,
  KeyD:NesButton.RIGHT,
  KeyW:NesButton.UP,
  KeyS:NesButton.DOWN,
  KeyQ:NesButton.SELECT,
  KeyE:NesButton.START,
};

/** 副手柄默认键盘映射：小键盘与方向键 */
export const PLAYER2_KEY_MAP:Record<string,NesButton>={
  Numpad1:NesButton.A,
  Numpad3:NesButton.B,
  ArrowLeft:NesButton.LEFT,
  ArrowRight:NesButton.RIGHT,
  ArrowUp:NesButton.UP,
  ArrowDown:NesButton.DOWN,
  Numpad4:NesButton.SELECT,
  Numpad6:NesButton.START,
};

type Map={[key:string]:number};

//左(主)手柄默认映射code
const baseLeftMap:Map=PLAYER1_KEY_MAP;
const baseRightMap:Map=PLAYER2_KEY_MAP;

export class Controller{
  //选通状态
  public strobe:boolean;
  //选通状态被关闭时，保存当前按键状态 8bit
  private keyState:number;
  private curKeyState:Array<boolean>;
  //按键映射散列表
  private map:Map;

  public reset(left:boolean):void{
    this.strobe=false;
    this.keyState=0;
    this.curKeyState=[];
    this.curKeyState.length=8;
    for(let i=0,l=8;i<l;i++){
      this.curKeyState[i]=false;
    }
    this.map=left?baseLeftMap:baseRightMap;
  }

  //自定义按键映射
  public setMap(_map:Map):void{
    this.map=_map;
  }

  //设置选通：strobe 为 1 时持续重载；1→0 时再锁存一次（兼容两种写法）
  public setStrobe(data:number):void{
    const old=this.strobe;
    this.strobe=(data&1)===1;
    if(this.strobe||(old&&!this.strobe)){
      this.saveKeyState();
    }
  }

  //保存当前按键状态
  private saveKeyState():void{
    this.keyState=0;
    for(let i=NesButton.A;i<=NesButton.RIGHT;i++){
      if(this.curKeyState[i]){
        this.keyState|=(1<<i);
      }
    }
  }

  //获取按键状态
  public getKeyState():number{
    let keyPressed:number;
    if(this.strobe){
      //选通状态下，只看按键A
      keyPressed=this.curKeyState[NesButton.A]?1:0;
    }else{
      //非选通状态 依次获取保存的按键状态
      keyPressed=this.keyState&1;
      this.keyState>>=1;
    }
    return 0x40|keyPressed;
  }

  //设置按键状态
  public setKeyState(key:string,value:boolean):void{
    if(this.map[key]!==undefined){
      this.curKeyState[this.map[key]]=value;
    }
  }

  /** 直接写入某一颗 NES 按键，供虚拟按键等外部输入使用 */
  public setButton(button:NesButton,pressed:boolean):void{
    if(!this.curKeyState){
      return;
    }
    this.curKeyState[button]=pressed;
  }
}