import {Main} from './main.ts';
let nes=new Main();
let inputDiv=nes.inputComponent();
let canvas=nes.canvasComponent();
document.body.appendChild(inputDiv);
document.body.appendChild(canvas);
//TODO 测试用
let button=document.createElement('button');
button.value='暂停';
button.style='width:100px;height:100px';
button.addEventListener('click',()=>{
  if(nes.isPause){
    nes.start();
  }else{
    nes.puase();
  }
  button.value=canvas.isPause?'开始':'暂停';
});
document.body.appendChild(button);
