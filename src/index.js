import {Main} from './main.ts';
let nes=new Main();
let inputDiv=nes.inputComponent();
let canvas=nes.canvasComponent();
document.body.appendChild(inputDiv);
document.body.appendChild(canvas);