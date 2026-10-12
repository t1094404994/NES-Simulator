import { Cpu } from './cpu';
import { CpuBus } from './cpuBus';
import { CartridgeReader } from './cartridge';
import { Ppu } from './ppu';
import { PpuBus } from './ppuBus';
import { Controller, NesButton } from './controller';
import { Apu, SAMPLE_PER_FRAME, SAMPLE_PER_SEC } from './apu';

export const NES_WIDTH = 256;
export const NES_HEIGHT = 240;

export type NesPlayer = 1 | 2;

/** 一帧画面。rgba 在下一次 onFrame 前有效，需要留存时请自行拷贝。 */
export interface NesFrame {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/** 一帧模拟产生的单声道采样。samples 在下一次 onAudio 前有效。 */
export interface NesAudioFrame {
  sampleRate: number;
  samples: Float32Array;
}

function scheduleFrame(cb: () => void): { id: number; raf: boolean } {
  if (typeof requestAnimationFrame === 'function') {
    return { id: requestAnimationFrame(cb), raf: true };
  }
  return { id: setTimeout(cb, 1000 / 60) as unknown as number, raf: false };
}

function cancelFrame(handle: { id: number; raf: boolean } | null): void {
  if (!handle) {
    return;
  }
  if (handle.raf && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle.id);
  } else {
    clearTimeout(handle.id);
  }
}

/**
 * 无 DOM 的 NES 主机。画面和音频通过回调交给外部，
 * 循环在浏览器里用 requestAnimationFrame，否则退回 setTimeout。
 */
export class Nes {
  onFrame: ((frame: NesFrame) => void) | null = null;
  onAudio: ((audio: NesAudioFrame) => void) | null = null;

  private cpubus: CpuBus;
  private cpu: Cpu;
  private ppuBus: PpuBus;
  private ppu: Ppu;
  private cartridge: CartridgeReader;
  private apu: Apu;
  private controllerL: Controller;
  private controllerR: Controller;

  private logicBaseFPS = 60;
  private logicFPS = 60;
  private renderFPS = 60;
  private speed = 1;
  private nextLogicTime = 0;
  private nextRenderTime = 0;
  private paused = true;
  private disposed = false;
  private frameHandle: { id: number; raf: boolean } | null = null;
  private frameRgba = new Uint8ClampedArray(NES_WIDTH * NES_HEIGHT * 4);
  private audioScratch = new Float32Array(Math.ceil(SAMPLE_PER_FRAME));
  private romLoaded = false;

  constructor() {
    this.cpubus = new CpuBus();
    this.cpu = new Cpu();
    this.ppuBus = new PpuBus();
    this.ppu = new Ppu();
    this.apu = new Apu();
    this.controllerL = new Controller();
    this.controllerR = new Controller();
    this.cpu.setCpuBus(this.cpubus);
    this.ppu.setCpu(this.cpu);
    this.ppu.setPpuBus(this.ppuBus);
    this.apu.setCpuBus(this.cpubus);
    this.cpubus.setCpu(this.cpu);
    this.cpubus.setPpu(this.ppu);
    this.cpubus.setApu(this.apu);
    this.cpubus.setControllerL(this.controllerL);
    this.cpubus.setControllerR(this.controllerR);
    this.cartridge = new CartridgeReader();
    this.controllerL.reset(true);
    this.controllerR.reset(false);
    this.enterFrame = this.enterFrame.bind(this);
  }

  get isPause(): boolean {
    return this.paused;
  }

  getSpeed(): number {
    return this.speed;
  }

  /** 模拟倍速。1 为原速，画面仍按 60fps 只提交最新一帧。 */
  setSpeed(multiplier: number): void {
    const speed = Number.isFinite(multiplier) ? Math.max(0.25, multiplier) : 1;
    this.speed = speed;
    this.logicFPS = this.logicBaseFPS * speed;
    this.nextLogicTime = 0;
  }

  loadRom(buffer: ArrayBuffer): boolean {
    const ok = this.cartridge.resetData(buffer);
    if (!ok) {
      this.romLoaded = false;
      return false;
    }
    this.cpubus.setCartridgeReader(this.cartridge);
    this.ppuBus.setCartridgeReader(this.cartridge);
    this.cpu.reset();
    this.ppu.reset();
    this.apu.reset();
    this.ppuBus.reset();
    this.controllerL.reset(true);
    this.controllerR.reset(false);
    this.romLoaded = true;
    this.nextLogicTime = 0;
    this.nextRenderTime = 0;
    return true;
  }

  setButton(player: NesPlayer, button: NesButton, pressed: boolean): void {
    const controller = player === 1 ? this.controllerL : this.controllerR;
    controller.setButton(button, pressed);
  }

  /** 跑一帧模拟，并抛出该帧音频。 */
  step(): void {
    const lastFrame = this.ppu.frameFinished;
    while (this.ppu.frameFinished === lastFrame) {
      const lastScanline = this.ppu.scanline;
      this.ppu.step();
      this.ppu.step();
      this.ppu.step();
      this.cpu.step();
      if (
        (this.ppu.scanline === 65 ||
          this.ppu.scanline === 130 ||
          this.ppu.scanline === 195 ||
          this.ppu.scanline === 260) &&
        this.ppu.scanline !== lastScanline
      ) {
        this.apu.step(this.cpubus.getCpuCycleFrame());
      }
    }
    this.cpu.randerCall();
    this.apu.finish();
    this.emitAudio();
    this.apu.clearSqe();
  }

  start(): void {
    if (this.disposed || !this.romLoaded) {
      return;
    }
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.nextLogicTime = 0;
    this.nextRenderTime = 0;
    this.enterFrame();
  }

  pause(): void {
    this.paused = true;
    this.nextLogicTime = 0;
    this.nextRenderTime = 0;
    cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  /** @deprecated 使用 pause() */
  puase(): void {
    this.pause();
  }

  dispose(): void {
    this.pause();
    this.disposed = true;
    this.onFrame = null;
    this.onAudio = null;
  }

  private enterFrame(): void {
    if (this.paused || this.disposed) {
      return;
    }
    const nowTime = Date.now();
    if (!this.nextLogicTime) {
      this.nextLogicTime = nowTime + 1000 / this.logicFPS;
      this.step();
    } else {
      let maxStep = 10;
      while (nowTime > this.nextLogicTime && maxStep--) {
        this.nextLogicTime += 1000 / this.logicFPS;
        this.step();
      }
    }
    if (!this.nextRenderTime) {
      this.nextRenderTime = nowTime + 1000 / this.renderFPS;
      this.emitFrame();
    } else if (nowTime > this.nextRenderTime) {
      this.nextRenderTime += 1000 / this.renderFPS;
      this.emitFrame();
    }
    this.frameHandle = scheduleFrame(this.enterFrame);
  }

  private emitFrame(): void {
    const src = new Uint8Array(this.ppu.frameDataView.buffer);
    this.frameRgba.set(src.subarray(0, this.frameRgba.length));
    if (this.onFrame) {
      this.onFrame({
        width: NES_WIDTH,
        height: NES_HEIGHT,
        rgba: this.frameRgba,
      });
    }
  }

  private emitAudio(): void {
    if (!this.onAudio) {
      return;
    }
    const n = Math.min(this.audioScratch.length, this.apu.seqDataArr.length);
    for (let i = 0; i < n; i++) {
      const s = this.apu.seqDataArr[i];
      this.audioScratch[i] = Number.isFinite(s) ? s : 0;
    }
    this.onAudio({
      sampleRate: SAMPLE_PER_SEC,
      samples: this.audioScratch.subarray(0, n),
    });
  }
}
