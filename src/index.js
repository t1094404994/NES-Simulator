import { Cpu } from './cpu';
import { CpuBus } from './cpuBus';
import {CartridgeReader} from './cartridge';
let cpubus=new CpuBus();
let cpu=new Cpu(cpubus);

function setData(evt){
  let target=evt.currentTarget;
  let file=target.files[0];
  file.arrayBuffer().then((buffer)=>{
    let car=new CartridgeReader();
    car.setCartridgeData(buffer);
    cpubus.init(car,cpu);
    cpu.reset();
    mainLoop();
  });
}

//TEST 主循环
function mainLoop(){
  cpu.step();
  requestAnimationFrame(mainLoop);
  return 0;
}
function component() {
  const element = document.createElement('div');
  const input = document.createElement('input');
  input.type='file';
  input.addEventListener('change',setData);
  element.appendChild(input);
  return element;
}

document.body.appendChild(component());