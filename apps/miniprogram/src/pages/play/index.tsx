import { API, apiUrl, type GameItem } from '@nes/shared';
import { Canvas, Text, View } from '@tarojs/components';
import Taro, { useReady, useRouter } from '@tarojs/taro';
import {
  frameDestRect,
  NES_HEIGHT,
  NES_WIDTH,
  Nes,
  NesAudioOut,
  NesButton,
  type NesFrame,
  type NesPixelScale,
  type NesStats,
} from 'nes-simulator';
import { useRef, useState } from 'react';
import './index.css';

interface Canvas2D {
  fillStyle: string;
  imageSmoothingEnabled: boolean;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  createImageData: (w: number, h: number) => { data: Uint8ClampedArray; width: number; height: number };
  putImageData: (data: { data: Uint8ClampedArray }, x: number, y: number) => void;
}

function paintFrame(
  ctx: Canvas2D,
  frame: NesFrame,
  stageW: number,
  stageH: number,
  pixelScale: NesPixelScale,
  cache: { image: { data: Uint8ClampedArray; width: number; height: number } | null },
): void {
  const rect = frameDestRect(stageW, stageH, pixelScale);
  if (!cache.image || cache.image.width !== rect.destW || cache.image.height !== rect.destH) {
    cache.image = ctx.createImageData(rect.destW, rect.destH);
  }
  const dest = cache.image.data;
  const src = frame.rgba;
  const scale = rect.scale;
  for (let y = 0; y < NES_HEIGHT; y++) {
    for (let x = 0; x < NES_WIDTH; x++) {
      const si = (y * NES_WIDTH + x) * 4;
      const r = src[si];
      const g = src[si + 1];
      const b = src[si + 2];
      const a = src[si + 3];
      for (let dy = 0; dy < scale; dy++) {
        const row = (y * scale + dy) * rect.destW;
        for (let dx = 0; dx < scale; dx++) {
          const di = (row + x * scale + dx) * 4;
          dest[di] = r;
          dest[di + 1] = g;
          dest[di + 2] = b;
          dest[di + 3] = a;
        }
      }
    }
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stageW, stageH);
  ctx.imageSmoothingEnabled = false;
  ctx.putImageData(cache.image, rect.dx, rect.dy);
}

function createWxAudio(): AudioContext {
  const create = (Taro as unknown as { createWebAudioContext?: () => AudioContext }).createWebAudioContext
    || (globalThis as unknown as { wx?: { createWebAudioContext?: () => AudioContext } }).wx?.createWebAudioContext;
  if (!create) {
    throw new Error('当前基础库没有 WebAudio');
  }
  return create();
}

export default function PlayPage() {
  const router = useRouter();
  const nesRef = useRef<Nes | null>(null);
  const audioRef = useRef<NesAudioOut | null>(null);
  const ctxRef = useRef<Canvas2D | null>(null);
  const stageRef = useRef({ w: 256, h: 240 });
  const scaleRef = useRef<NesPixelScale>('fit');
  const imageCache = useRef<{ image: { data: Uint8ClampedArray; width: number; height: number } | null }>({ image: null });
  const [title, setTitle] = useState('加载中');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState<NesPixelScale>('fit');
  const [debug, setDebug] = useState(false);
  const [stats, setStats] = useState<NesStats>({ presentFps: 0, simFps: 0 });
  const lastFrameRef = useRef<NesFrame | null>(null);
  const debugRef = useRef(false);

  useReady(() => {
    const id = router.params.id;
    if (!id) {
      setError('缺少游戏 id');
      return;
    }
    Taro.createSelectorQuery()
      .select('#nesCanvas')
      .fields({ node: true, size: true })
      .exec((result) => {
        const info = result?.[0] as { node?: { width: number; height: number; getContext: (kind: string) => Canvas2D }; width?: number; height?: number } | undefined;
        const canvas = info?.node;
        if (!canvas) {
          setError('画布初始化失败');
          return;
        }
        const dpr = Taro.getWindowInfo?.().pixelRatio || 2;
        const width = Math.max(1, Math.floor((info?.width || 1) * dpr));
        const height = Math.max(1, Math.floor((info?.height || 1) * dpr));
        canvas.width = width;
        canvas.height = height;
        ctxRef.current = canvas.getContext('2d');
        stageRef.current = { w: width, h: height };
        setReady(true);
      });

    const nes = new Nes();
    const audio = new NesAudioOut(() => createWxAudio());
    const paint = (frame: NesFrame) => {
      const ctx = ctxRef.current;
      if (!ctx) {
        return;
      }
      paintFrame(ctx, frame, stageRef.current.w, stageRef.current.h, scaleRef.current, imageCache.current);
    };
    nes.onFrame = (frame) => {
      lastFrameRef.current = frame;
      paint(frame);
    };
    nes.onPresent = () => {
      const frame = lastFrameRef.current;
      if (frame) {
        paint(frame);
      }
    };
    nes.onStats = (next) => {
      setStats({
        presentFps: Math.round(next.presentFps),
        simFps: Math.round(next.simFps),
      });
    };
    nes.onAudio = (frame) => audio.push(frame);
    nesRef.current = nes;
    audioRef.current = audio;

    void (async () => {
      const gameResponse = await Taro.request<GameItem>({ url: apiUrl(API_BASE, API.game(id)) });
      if (gameResponse.statusCode !== 200) {
        throw new Error('找不到这款游戏');
      }
      setTitle(gameResponse.data.title);
      const romResponse = await Taro.request<ArrayBuffer>({
        url: apiUrl(API_BASE, API.rom(id)),
        responseType: 'arraybuffer',
      });
      if (romResponse.statusCode !== 200) {
        throw new Error('ROM 下载失败');
      }
      const rom = romResponse.data;
      if (!nes.loadRom(rom)) {
        throw new Error('无法识别的 ROM');
      }
    })().catch((err: Error) => {
      setError(err.message || '加载失败');
    });
  });

  function toggleDebug() {
    const next = !debugRef.current;
    debugRef.current = next;
    setDebug(next);
    nesRef.current?.setDebug(next);
  }

  function applySpeed(next: number) {
    setSpeed(next);
    nesRef.current?.setSpeed(next);
    audioRef.current?.setSpeed(next);
  }

  function applyScale(next: NesPixelScale) {
    scaleRef.current = next;
    setScale(next);
    imageCache.current.image = null;
  }

  function begin() {
    const nes = nesRef.current;
    const audio = audioRef.current;
    if (!nes || !ready) {
      return;
    }
    try {
      audio?.unlock();
      audio?.setSpeed(speed);
      audio?.resume();
    } catch {
      // 没有 WebAudio 时仍然可以玩，只是没有声音
    }
    nes.setSpeed(speed);
    nes.start();
    setStarted(true);
    setPaused(false);
  }

  function togglePause() {
    if (!started) {
      begin();
      return;
    }
    if (paused) {
      try {
        audioRef.current?.setSpeed(speed);
        audioRef.current?.resume();
      } catch {
        //
      }
      nesRef.current?.start();
      setPaused(false);
    } else {
      nesRef.current?.pause();
      audioRef.current?.pause();
      setPaused(true);
    }
  }

  function hold(button: NesButton, pressed: boolean) {
    nesRef.current?.setButton(1, button, pressed);
  }

  return (
    <View className="page">
      <View className="stage">
        <Canvas type="2d" id="nesCanvas" canvasId="nesCanvas" className="stage-canvas" />
      </View>
      {error ? <Text className="hint">{error}</Text> : <Text className="hint">{title}</Text>}
      {debug ? (
        <Text className="hint">画面 {stats.presentFps} · 模拟 {stats.simFps}</Text>
      ) : null}
      <View className="bar">
        <Text className="chip" onClick={togglePause}>{!started || paused ? '开始' : '暂停'}</Text>
        <Text className={debug ? 'chip on' : 'chip'} onClick={toggleDebug}>{debug ? '调试开' : '调试'}</Text>
        {[1, 2, 3, 4].map((value) => (
          <Text key={value} className={speed === value ? 'chip on' : 'chip'} onClick={() => applySpeed(value)}>
            {value}x
          </Text>
        ))}
        {(['fit', 1, 2, 3, 4] as const).map((value) => (
          <Text
            key={String(value)}
            className={scale === value ? 'chip on' : 'chip'}
            onClick={() => applyScale(value)}
          >
            {value === 'fit' ? '适应' : `${value}x像素`}
          </Text>
        ))}
      </View>
      <View className="pad">
        <View className="dpad">
          <Text className="pad-btn pad-up" onTouchStart={() => hold(NesButton.UP, true)} onTouchEnd={() => hold(NesButton.UP, false)} onTouchCancel={() => hold(NesButton.UP, false)}>上</Text>
          <Text className="pad-btn pad-left" onTouchStart={() => hold(NesButton.LEFT, true)} onTouchEnd={() => hold(NesButton.LEFT, false)} onTouchCancel={() => hold(NesButton.LEFT, false)}>左</Text>
          <Text className="pad-btn pad-right" onTouchStart={() => hold(NesButton.RIGHT, true)} onTouchEnd={() => hold(NesButton.RIGHT, false)} onTouchCancel={() => hold(NesButton.RIGHT, false)}>右</Text>
          <Text className="pad-btn pad-down" onTouchStart={() => hold(NesButton.DOWN, true)} onTouchEnd={() => hold(NesButton.DOWN, false)} onTouchCancel={() => hold(NesButton.DOWN, false)}>下</Text>
        </View>
        <View className="menu">
          <Text className="pad-btn" onTouchStart={() => hold(NesButton.SELECT, true)} onTouchEnd={() => hold(NesButton.SELECT, false)} onTouchCancel={() => hold(NesButton.SELECT, false)}>Select</Text>
          <Text className="pad-btn" onTouchStart={() => hold(NesButton.START, true)} onTouchEnd={() => hold(NesButton.START, false)} onTouchCancel={() => hold(NesButton.START, false)}>Start</Text>
        </View>
        <View className="actions">
          <Text className="pad-btn" onTouchStart={() => hold(NesButton.B, true)} onTouchEnd={() => hold(NesButton.B, false)} onTouchCancel={() => hold(NesButton.B, false)}>B</Text>
          <Text className="pad-btn" onTouchStart={() => hold(NesButton.A, true)} onTouchEnd={() => hold(NesButton.A, false)} onTouchCancel={() => hold(NesButton.A, false)}>A</Text>
        </View>
      </View>
    </View>
  );
}
