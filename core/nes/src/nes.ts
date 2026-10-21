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

export type NesFrameMode = 'full' | 'delta';

/** 相对上一帧变化的 8×8 块。rgba 在下一次 onFrame 前有效。 */
export interface NesFrameTile {
  x: number;
  y: number;
  rgba: Uint8ClampedArray;
}

const TILE = 8;
const TILE_COLS = NES_WIDTH / TILE;
const TILE_ROWS = NES_HEIGHT / TILE;
const TILE_COUNT = TILE_COLS * TILE_ROWS;
const TILE_WORDS = TILE * TILE;
const DIRTY_LIMIT = TILE_COUNT >> 1;
const NO_TILES: readonly NesFrameTile[] = [];

/** 一帧画面。rgba 和 tiles 在下一次 onFrame 前有效，需要留存时请自行拷贝。 */
export interface NesFrame {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  /** 为 true 时宿主应使用整帧 rgba，tiles 为空。 */
  keyframe: boolean;
  /** delta 模式下发生变化的瓦片。 */
  tiles: readonly NesFrameTile[];
}

function hashTile(src: Uint32Array, tx: number, ty: number): number {
  let hash = 0x811c9dc5;
  let word = (ty * TILE) * NES_WIDTH + tx * TILE;
  for (let row = 0; row < TILE; row += 1) {
    for (let col = 0; col < TILE; col += 1) {
      hash ^= src[word + col];
      hash = Math.imul(hash, 0x01000193);
    }
    word += NES_WIDTH;
  }
  return hash >>> 0;
}

function copyTile(src: Uint32Array, tx: number, ty: number, dst: Uint32Array, dstWord: number): void {
  let srcWord = (ty * TILE) * NES_WIDTH + tx * TILE;
  let dest = dstWord;
  for (let row = 0; row < TILE; row += 1) {
    dst.set(src.subarray(srcWord, srcWord + TILE), dest);
    srcWord += NES_WIDTH;
    dest += TILE;
  }
}

/** 一帧模拟产生的单声道采样。samples 在下一次 onAudio 前有效。 */
export interface NesAudioFrame {
  sampleRate: number;
  samples: Float32Array;
}

/** 调试统计。presentFps 是画到屏幕的次数，simFps 是 NES 内部帧。 */
export interface NesStats {
  presentFps: number;
  simFps: number;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
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
  /** 没有新模拟帧时，用上一帧再画一次。 */
  onPresent: (() => void) | null = null;
  /** setDebug(true) 后大约每半秒回调一次。 */
  onStats: ((stats: NesStats) => void) | null = null;
  /** 电池档有字节变化。宿主去抖后写入本地存储。 */
  onSaveDirty: (() => void) | null = null;

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
  private speed = 1;
  private nextLogicTime = 0;
  private paused = true;
  private disposed = false;
  private debug = false;
  private presentCount = 0;
  private simCount = 0;
  private statsWindowStart = 0;
  private frameHandle: { id: number; raf: boolean } | null = null;
  private frameRgba: Uint8ClampedArray;
  private frameWords: Uint32Array;
  private audioScratch = new Float32Array(Math.ceil(SAMPLE_PER_FRAME));
  private romLoaded = false;
  private frameMode: NesFrameMode = 'delta';
  private frameSeen = false;
  private prevHash = new Uint32Array(TILE_COUNT);
  private changedRgba = new Uint8ClampedArray(TILE_COUNT * TILE * TILE * 4);
  private changedWords = new Uint32Array(this.changedRgba.buffer);
  private tiles: NesFrameTile[] = [];

  constructor() {
    this.cpubus = new CpuBus();
    this.cpu = new Cpu();
    this.ppuBus = new PpuBus();
    this.ppu = new Ppu();
    this.frameRgba = new Uint8ClampedArray(this.ppu.frameData);
    this.frameWords = this.ppu.frameWords;
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
    this.cartridge.onBatteryDirty = () => {
      this.onSaveDirty?.();
    };
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

  getFrameMode(): NesFrameMode {
    return this.frameMode;
  }

  /**
   * full 每次提交整帧。delta 只列出相对上一张已显示画面变化的 8×8 块，
   * 变化超过一半时改为关键帧。默认 delta。
   */
  setFrameMode(mode: NesFrameMode): void {
    this.frameMode = mode;
    this.frameSeen = false;
  }

  /** 下一帧按整帧提交，供更换渲染器后补画面。 */
  requestKeyframe(): void {
    this.frameSeen = false;
  }

  /** 用当前 PPU 画面立刻回调一次。暂停时更换渲染器也会补上画面。 */
  redraw(): void {
    if (this.disposed || !this.romLoaded) {
      return;
    }
    this.emitFrame();
  }

  /** 打开后统计画面输出和模拟帧率。 */
  setDebug(on: boolean): void {
    this.debug = on;
    this.presentCount = 0;
    this.simCount = 0;
    this.statsWindowStart = 0;
  }

  /** 模拟倍速。1 为原速。画面跟显示器刷新，模拟仍按 60 乘倍速。 */
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
    this.frameSeen = false;
    this.nextLogicTime = 0;
    return true;
  }

  /** iNES 电池位，并且这颗 mapper 有可保存的 RAM 或 EEPROM。 */
  hasBattery(): boolean {
    if (!this.romLoaded || !this.cartridge.hasAddedRom) {
      return false;
    }
    const mapper = this.cartridge.mapper;
    return !!(mapper?.addRam || mapper?.exportBattery);
  }

  /** 拷贝当前电池档。没有电池时返回 null。 */
  exportSave(): Uint8Array | null {
    if (!this.hasBattery()) {
      return null;
    }
    const mapper = this.cartridge.mapper;
    if (mapper.exportBattery) {
      return mapper.exportBattery();
    }
    if (!mapper.addRam) {
      return null;
    }
    return new Uint8Array(mapper.addRam.slice(0));
  }

  /** 写回电池档。长度和当前档不一致时忽略。 */
  importSave(bytes: Uint8Array): void {
    if (!this.hasBattery()) {
      return;
    }
    const mapper = this.cartridge.mapper;
    if (mapper.importBattery) {
      mapper.importBattery(bytes);
      return;
    }
    const ram = mapper.addRamDataView;
    if (!ram || bytes.length !== ram.length) {
      return;
    }
    ram.set(bytes);
  }

  setButton(player: NesPlayer, button: NesButton, pressed: boolean): void {
    const controller = player === 1 ? this.controllerL : this.controllerR;
    controller.setButton(button, pressed);
  }

  /** 跑一帧模拟，并抛出该帧音频。 */
  step(): void {
    const lastFrame = this.ppu.frameFinished;
    while (this.ppu.frameFinished === lastFrame) {
      this.tickCpuCycle();
      while (this.cpu.pendingCycles() > 0 && this.ppu.frameFinished === lastFrame) {
        this.tickCpuCycle();
      }
    }
    this.cpu.randerCall();
    this.apu.finish();
    this.emitAudio();
    this.apu.clearSqe();
  }

  /** 3 个 PPU 点，然后 1 个 CPU 周期。空等周期由 step 在内层排空。 */
  private tickCpuCycle(): void {
    const lastScanline = this.ppu.scanline;
    this.ppu.runDots(3);
    this.cpu.step();
    this.cartridge.mapper?.clockCpu?.();
    const scanline = this.ppu.scanline;
    if (
      (scanline === 65 || scanline === 130 || scanline === 195 || scanline === 260) &&
      scanline !== lastScanline
    ) {
      this.apu.step(this.cpubus.getCpuCycleFrame());
    }
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
    this.statsWindowStart = 0;
    this.presentCount = 0;
    this.simCount = 0;
    this.enterFrame();
  }

  pause(): void {
    this.paused = true;
    this.nextLogicTime = 0;
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
    this.onPresent = null;
    this.onStats = null;
    this.onSaveDirty = null;
  }

  private enterFrame(): void {
    if (this.paused || this.disposed) {
      return;
    }
    const nowTime = nowMs();
    let simSteps = 0;
    if (!this.nextLogicTime) {
      this.nextLogicTime = nowTime + 1000 / this.logicFPS;
      this.step();
      simSteps = 1;
    } else {
      let maxStep = 10;
      while (nowTime > this.nextLogicTime && maxStep--) {
        this.nextLogicTime += 1000 / this.logicFPS;
        this.step();
        simSteps += 1;
      }
    }
    if (simSteps > 0) {
      this.emitFrame();
    } else if (this.onPresent) {
      this.onPresent();
    }
    this.notePresent(nowTime, simSteps);
    this.frameHandle = scheduleFrame(this.enterFrame);
  }

  private notePresent(nowTime: number, simSteps: number): void {
    if (!this.debug) {
      return;
    }
    this.presentCount += 1;
    this.simCount += simSteps;
    if (!this.statsWindowStart) {
      this.statsWindowStart = nowTime;
      this.presentCount = 0;
      this.simCount = 0;
      return;
    }
    const elapsed = nowTime - this.statsWindowStart;
    if (elapsed < 500) {
      return;
    }
    const scale = 1000 / elapsed;
    this.onStats?.({
      presentFps: this.presentCount * scale,
      simFps: this.simCount * scale,
    });
    this.presentCount = 0;
    this.simCount = 0;
    this.statsWindowStart = nowTime;
  }

  private emitFrame(): void {
    if (!this.onFrame) {
      return;
    }
    if (this.frameMode === 'full' || !this.frameSeen) {
      if (this.frameMode === 'delta') {
        this.captureHashes();
        this.frameSeen = true;
      }
      this.onFrame({
        width: NES_WIDTH,
        height: NES_HEIGHT,
        rgba: this.frameRgba,
        keyframe: true,
        tiles: NO_TILES,
      });
      return;
    }

    const words = this.frameWords;
    let count = 0;
    for (let ty = 0; ty < TILE_ROWS; ty += 1) {
      for (let tx = 0; tx < TILE_COLS; tx += 1) {
        const index = ty * TILE_COLS + tx;
        const hash = hashTile(words, tx, ty);
        if (hash === this.prevHash[index]) {
          continue;
        }
        this.prevHash[index] = hash;
        copyTile(words, tx, ty, this.changedWords, count * TILE_WORDS);
        const tile = this.tiles[count] ?? { x: 0, y: 0, rgba: this.changedRgba.subarray(0, TILE_WORDS * 4) };
        tile.x = tx;
        tile.y = ty;
        tile.rgba = this.changedRgba.subarray(count * TILE_WORDS * 4, (count + 1) * TILE_WORDS * 4);
        this.tiles[count] = tile;
        count += 1;
      }
    }
    this.tiles.length = count;
    const keyframe = count > DIRTY_LIMIT;
    this.onFrame({
      width: NES_WIDTH,
      height: NES_HEIGHT,
      rgba: this.frameRgba,
      keyframe,
      tiles: keyframe ? NO_TILES : this.tiles,
    });
  }

  private captureHashes(): void {
    const words = this.frameWords;
    for (let ty = 0; ty < TILE_ROWS; ty += 1) {
      for (let tx = 0; tx < TILE_COLS; tx += 1) {
        this.prevHash[ty * TILE_COLS + tx] = hashTile(words, tx, ty);
      }
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
