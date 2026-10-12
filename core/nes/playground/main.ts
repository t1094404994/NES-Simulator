import { Main } from 'nes-simulator';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app not found');
}

const nes = new Main();
const inputDiv = nes.inputComponent();
const canvas = nes.canvasComponent();
app.appendChild(inputDiv);
app.appendChild(canvas);

const button = document.createElement('button');
button.type = 'button';
button.textContent = '暂停';
button.style.cssText = 'width:100px;height:100px';
button.addEventListener('click', () => {
  if (nes.isPause) {
    nes.start();
  } else {
    nes.puase();
  }
  button.textContent = nes.isPause ? '开始' : '暂停';
});
app.appendChild(button);
