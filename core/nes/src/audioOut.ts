import { SAMPLE_PER_SEC } from './apu';
import type { NesAudioFrame } from './nes';

type AudioContextCtor = typeof AudioContext;

interface AudioContextLike {
  sampleRate: number;
  state: AudioContextState;
  currentTime: number;
  destination: AudioNode;
  resume: () => Promise<void>;
  suspend: () => Promise<void>;
  close?: () => Promise<void>;
  createGain: () => GainNode;
  createScriptProcessor?: (bufferSize: number, inputs: number, outputs: number) => ScriptProcessorNode;
  createBuffer: (channels: number, length: number, sampleRate: number) => AudioBuffer;
  createBufferSource: () => AudioBufferSourceNode;
}

export type CreateAudioContext = () => AudioContextLike;

function defaultCreateContext(): AudioContextLike {
  const Ctx: AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
  try {
    return new Ctx({ sampleRate: SAMPLE_PER_SEC });
  } catch {
    return new Ctx();
  }
}

/**
 * 把 Nes.onAudio 的采样播出来。
 * 优先用 ScriptProcessor 拉取；没有该方法时（如微信 WebAudio）改为排队 BufferSource。
 * 倍速通过加快读取实现，音高会跟着升高。
 */
export class NesAudioOut {
  private createContext: CreateAudioContext;
  private audio: AudioContextLike | null = null;
  private gainNode: GainNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private useBufferQueue = false;
  private ring: Float32Array | null = null;
  private writePos = 0;
  private readPos = 0;
  private buffered = 0;
  private readFrac = 0;
  private dcPrevIn = 0;
  private dcPrevOut = 0;
  private speed = 1;
  private paused = true;
  private queued = 0;
  private nextTime = 0;
  private session = 0;
  private readonly onAudioProcessBound = (event: AudioProcessingEvent) => {
    this.onAudioProcess(event);
  };

  constructor(createContext?: CreateAudioContext) {
    this.createContext = createContext ?? defaultCreateContext;
  }

  setSpeed(multiplier: number): void {
    this.speed = Number.isFinite(multiplier) ? Math.max(0.25, multiplier) : 1;
  }

  /** 在用户手势的同步栈里调用，创建并恢复 AudioContext。 */
  unlock(): void {
    this.ensureContext();
    if (this.audio && this.audio.state === 'suspended') {
      void this.audio.resume();
    }
  }

  resume(): void {
    this.paused = false;
    this.unlock();
    this.nextTime = 0;
    this.scheduleBuffers();
  }

  pause(): void {
    this.paused = true;
    this.session++;
    this.queued = 0;
    this.clearRing();
    if (this.audio && this.audio.state === 'running') {
      void this.audio.suspend();
    }
  }

  push(frame: NesAudioFrame): void {
    if (!this.ring || this.paused) {
      return;
    }
    const ring = this.ring;
    const ringLen = ring.length;
    const src = frame.samples;
    for (let i = 0; i < src.length; i++) {
      let s = src[i];
      if (!Number.isFinite(s)) {
        s = 0;
      }
      const y = s - this.dcPrevIn + 0.996 * this.dcPrevOut;
      this.dcPrevIn = s;
      this.dcPrevOut = y;
      if (this.buffered >= ringLen) {
        this.readPos = (this.readPos + 1) % ringLen;
        this.buffered--;
      }
      ring[this.writePos] = y;
      this.writePos = (this.writePos + 1) % ringLen;
      this.buffered++;
    }
    this.scheduleBuffers();
  }

  dispose(): void {
    this.pause();
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    this.gainNode?.disconnect();
    this.gainNode = null;
    if (this.audio?.close) {
      void this.audio.close();
    }
    this.audio = null;
  }

  private ensureContext(): void {
    if (this.audio) {
      return;
    }
    this.audio = this.createContext();
    const ringLen = SAMPLE_PER_SEC * 2;
    this.ring = new Float32Array(ringLen);
    this.gainNode = this.audio.createGain();
    this.gainNode.gain.value = 0.85;
    this.gainNode.connect(this.audio.destination);

    if (typeof this.audio.createScriptProcessor === 'function') {
      this.scriptNode = this.audio.createScriptProcessor(2048, 0, 1);
      this.scriptNode.onaudioprocess = this.onAudioProcessBound;
      this.scriptNode.connect(this.gainNode);
      this.useBufferQueue = false;
    } else {
      this.useBufferQueue = true;
    }
  }

  private clearRing(): void {
    this.ring?.fill(0);
    this.writePos = 0;
    this.readPos = 0;
    this.buffered = 0;
    this.readFrac = 0;
    this.dcPrevIn = 0;
    this.dcPrevOut = 0;
    this.nextTime = 0;
  }

  private sampleStep(): number {
    const dstRate = this.audio ? this.audio.sampleRate : SAMPLE_PER_SEC;
    return (SAMPLE_PER_SEC / dstRate) * this.speed;
  }

  private readInto(out: Float32Array): void {
    if (!this.ring) {
      out.fill(0);
      return;
    }
    const ring = this.ring;
    const ringLen = ring.length;
    const step = this.sampleStep();
    for (let i = 0; i < out.length; i++) {
      if (this.buffered > 0) {
        const i0 = this.readPos;
        const i1 = (i0 + 1) % ringLen;
        const frac = this.readFrac;
        out[i] = ring[i0] * (1 - frac) + ring[i1] * frac;
        this.readFrac += step;
        while (this.readFrac >= 1 && this.buffered > 0) {
          this.readFrac -= 1;
          this.readPos = (this.readPos + 1) % ringLen;
          this.buffered--;
        }
      } else {
        out[i] = 0;
      }
    }
  }

  private onAudioProcess(event: AudioProcessingEvent): void {
    const out = event.outputBuffer.getChannelData(0);
    if (this.paused) {
      out.fill(0);
      return;
    }
    this.readInto(out);
  }

  private scheduleBuffers(): void {
    if (!this.useBufferQueue || this.paused || !this.audio || !this.gainNode) {
      return;
    }
    if (this.audio.state !== 'running') {
      return;
    }
    const ctx = this.audio;
    const frames = 2048;
    while (this.queued < 3 && this.buffered > frames) {
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      this.readInto(buffer.getChannelData(0));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      const startAt = Math.max(ctx.currentTime + 0.02, this.nextTime);
      source.start(startAt);
      const duration = frames / ctx.sampleRate;
      this.nextTime = startAt + duration;
      this.queued++;
      const session = this.session;
      setTimeout(() => {
        if (session !== this.session) {
          return;
        }
        this.queued = Math.max(0, this.queued - 1);
        this.scheduleBuffers();
      }, duration * 1000);
    }
  }
}
