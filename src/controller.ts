//NES手柄
enum NesKey{
  A,
  B,
  SELECT,
  START,
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

type Map={[key:string]:number};

//左(主)手柄默认映射code
const baseLeftMap:Map={KeyJ:NesKey.A,KeyL:NesKey.B,KeyA:NesKey.LEFT,KeyD:NesKey.RIGHT,KeyW:NesKey.UP,KeyS:NesKey.DOWN,KeyQ:NesKey.SELECT,KeyE:NesKey.START};
const baseRightMap:Map={Numpad1:NesKey.A,Numpad3:NesKey.B,ArrowLeft:NesKey.LEFT,ArrowRight:NesKey.RIGHT,ArrowUp:NesKey.UP,ArrowDown:NesKey.DOWN,Numpad4:NesKey.SELECT,Numpad6:NesKey.START};

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

  //设置选通装填
  public setStrobe(data:number):void{
    const old:boolean=this.strobe;
    this.strobe=(data&1)===1;
    //选通状态关闭时
    if(old&&!this.strobe){
      this.saveKeyState();
    }
  }

  //保存当前按键状态
  private saveKeyState():void{
    this.keyState=0;
    for(let i=NesKey.A;i<=NesKey.RIGHT;i++){
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
      keyPressed=this.curKeyState[NesKey.A]?1:0;
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
}