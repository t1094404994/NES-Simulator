import { PLAYER1_KEY_MAP, PLAYER2_KEY_MAP } from './controller';
import { NesAudioOut } from './audioOut';
import { Nes } from './nes';
import { NesScreen } from './screen';

/** 浏览器演示用适配层：文件选择、拖放、键盘、自带画布和音频。 */
export class Main {
  private nes = new Nes();
  private audioOut = new NesAudioOut();
  private screen: NesScreen | null = null;
  private canvas: HTMLCanvasElement;
  private canvasDiv: HTMLDivElement | null = null;
  private inputDiv: HTMLDivElement | null = null;
  private input: HTMLInputElement | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 240;
    this.screen = new NesScreen(this.canvas);
    this.screen.setAspect('native');
    this.screen.setPixelScale(1);
    this.screen.resize(256, 240);
    this.nes.onFrame = (frame) => {
      this.screen?.draw(frame);
    };
    this.nes.onAudio = (frame) => {
      this.audioOut.push(frame);
    };
    this.setCartidegData = this.setCartidegData.bind(this);
    this.setInputData = this.setInputData.bind(this);
    this.onDropover = this.onDropover.bind(this);
    this.onDrag = this.onDrag.bind(this);
    this.onkeyboardEvent = this.onkeyboardEvent.bind(this);
  }

  get isPause(): boolean {
    return this.nes.isPause;
  }

  setSpeed(multiplier: number): void {
    this.nes.setSpeed(multiplier);
    this.audioOut.setSpeed(multiplier);
  }

  setCartidegData(data: ArrayBuffer): void {
    this.removeControllerEvent();
    if (this.nes.loadRom(data)) {
      this.addControllerEvent();
      this.start();
    }
  }

  step(): number {
    this.nes.step();
    return 0;
  }

  start(): void {
    this.audioOut.unlock();
    this.audioOut.setSpeed(this.nes.getSpeed());
    this.audioOut.resume();
    this.nes.start();
  }

  pause(): void {
    this.nes.pause();
    this.audioOut.pause();
  }

  /** @deprecated 使用 pause() */
  puase(): void {
    this.pause();
  }

  setInputData(evt: Event): void {
    const target = evt.currentTarget as HTMLInputElement;
    const file = target.files && target.files[0];
    if (!file) {
      return;
    }
    this.audioOut.unlock();
    target.value = '';
    void this.loadRomFromFile(file);
  }

  inputComponent(): HTMLElement {
    if (!this.inputDiv) {
      this.inputDiv = document.createElement('div');
    }
    if (!this.input) {
      this.input = document.createElement('input');
      this.input.type = 'file';
      this.input.name = 'rom';
      this.input.accept = '.nes,.NES,application/octet-stream';
      this.input.setAttribute('aria-label', '选择 NES ROM');
      this.input.addEventListener('change', this.setInputData);
      this.inputDiv.appendChild(this.input);
    }
    return this.inputDiv;
  }

  canvasComponent(): HTMLElement {
    if (!this.canvas.getContext) {
      throw new Error('哦豁,你的浏览器不支持canvas');
    }
    if (!this.canvasDiv) {
      this.canvasDiv = document.createElement('div');
      this.canvasDiv.appendChild(this.canvas);
      this.canvasDiv.addEventListener('drop', this.onDropover);
      this.canvasDiv.addEventListener('dragenter', this.onDrag);
      this.canvasDiv.addEventListener('dragover', this.onDrag);
    }
    return this.canvasDiv;
  }

  onDrag(evt: DragEvent): void {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  onDropover(evt: DragEvent): void {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    const file = evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files[0];
    if (!file) {
      return;
    }
    this.audioOut.unlock();
    void this.loadRomFromFile(file);
  }

  onkeyboardEvent(event: KeyboardEvent): void {
    const pressed = event.type === 'keydown';
    const button1 = PLAYER1_KEY_MAP[event.code];
    const button2 = PLAYER2_KEY_MAP[event.code];
    if (button1 !== undefined) {
      this.nes.setButton(1, button1, pressed);
    }
    if (button2 !== undefined) {
      this.nes.setButton(2, button2, pressed);
    }
  }

  addControllerEvent(): void {
    window.addEventListener('keydown', this.onkeyboardEvent);
    window.addEventListener('keyup', this.onkeyboardEvent);
  }

  removeControllerEvent(): void {
    window.removeEventListener('keydown', this.onkeyboardEvent);
    window.removeEventListener('keyup', this.onkeyboardEvent);
  }

  disposeComponent(): void {
    //
  }

  dispose(): void {
    this.removeControllerEvent();
    this.nes.dispose();
    this.audioOut.dispose();
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.onerror = () => {
        reject(reader.error || new Error('FileReader failed'));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  private async loadRomFromFile(file: File): Promise<void> {
    try {
      const buffer =
        typeof file.arrayBuffer === 'function'
          ? await file.arrayBuffer()
          : await this.readFileAsArrayBuffer(file);
      this.setCartidegData(buffer);
    } catch (err) {
      console.error('加载 ROM 失败', err);
    }
  }
}
