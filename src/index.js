import { Cpu } from './cpu';
import { CpuBus } from './cpuBus';

function component() {
  const element = document.createElement('div');
  const btn = document.createElement('button');
  btn.innerHTML = 'Click me and check the console!';
  element.appendChild(btn);
  var cpubus=new CpuBus();
  var cpu=new Cpu(cpubus);
  cpu.reset();
  return element;
}

document.body.appendChild(component());