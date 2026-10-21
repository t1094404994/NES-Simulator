'use client';

import { Button, Flex, Select, Text } from '@radix-ui/themes';
import {
  Nes,
  NesAudioOut,
  NesButton,
  PLAYER1_KEY_MAP,
  PLAYER2_KEY_MAP,
  detectRenderers,
  openPresenter,
  romSaveKey,
  type NesAspect,
  type NesFrame,
  type NesPixelScale,
  type NesPresenter,
  type NesRendererKind,
} from 'nes-simulator';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { deleteBattery, readBattery, writeBattery } from '@/lib/batterySave';
import { Drawer, useDrawerContainer } from './Drawer';
import { PlayShell } from './PlayShell';
import { type PadButton } from './VirtualPad';

const ASPECT_PARTS: Record<NesAspect, readonly [number, number]> = {
  '16:9': [16, 9],
  '4:3': [4, 3],
  native: [256, 240],
};

const PAD_TO_NES: Record<PadButton, NesButton> = {
  a: NesButton.A,
  b: NesButton.B,
  select: NesButton.SELECT,
  start: NesButton.START,
  up: NesButton.UP,
  down: NesButton.DOWN,
  left: NesButton.LEFT,
  right: NesButton.RIGHT,
};

const RENDERER_LABEL: Record<NesRendererKind, string> = {
  webgpu: 'WebGPU',
  webgl: 'WebGL',
  '2d': 'Canvas 2D',
};

function toPixelScale(value: string): NesPixelScale {
  if (value === 'fit') {
    return 'fit';
  }
  return Number(value) as NesPixelScale;
}

function MenuSelect({ children }: { children: ReactNode }) {
  const container = useDrawerContainer();
  return (
    <Select.Content container={container ?? undefined} position="popper">
      {children}
    </Select.Content>
  );
}

function stageStyle(aspect: NesAspect): CSSProperties {
  const [width, height] = ASPECT_PARTS[aspect];
  return {
    aspectRatio: `${width} / ${height}`,
    '--ar-w': width,
    '--ar-h': height,
  } as CSSProperties;
}

export function Emulator({
  rom,
  title,
  coverUrl,
  onError,
}: {
  rom: ArrayBuffer;
  title: string;
  coverUrl?: string | null;
  onError?: (message: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nesRef = useRef<Nes | null>(null);
  const screenRef = useRef<NesPresenter | null>(null);
  const audioRef = useRef<NesAudioOut | null>(null);
  const drawRef = useRef<(frame: NesFrame) => void>(() => {});
  const menuOpenRef = useRef(false);
  const onErrorRef = useRef(onError);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState('1');
  const [scale, setScale] = useState('fit');
  const [aspect, setAspect] = useState<NesAspect>('16:9');
  const [error, setError] = useState('');
  const [renderer, setRenderer] = useState<NesRendererKind>('2d');
  const [renderers, setRenderers] = useState<NesRendererKind[]>(['2d']);
  const [debug, setDebug] = useState(false);
  const [battery, setBattery] = useState(false);
  const [stats, setStats] = useState({ presentFps: 0, simFps: 0 });
  const debugRef = useRef(debug);
  const flushSaveRef = useRef<() => void>(() => {});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  debugRef.current = debug;
  const speedRef = useRef(speed);
  const scaleRef = useRef(scale);
  const aspectRef = useRef(aspect);
  speedRef.current = speed;
  scaleRef.current = scale;
  aspectRef.current = aspect;
  menuOpenRef.current = menuOpen;
  onErrorRef.current = onError;

  useEffect(() => {
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
    };
  }, []);

  useEffect(() => {
    const found = detectRenderers();
    setRenderers(found);
    setRenderer(found[0] ?? '2d');
  }, []);

  useEffect(() => {
    const audio = new NesAudioOut();
    const nes = new Nes();
    nes.onFrame = (frame) => drawRef.current(frame);
    nes.onPresent = () => screenRef.current?.present();
    nes.onStats = (next) => {
      setStats({
        presentFps: Math.round(next.presentFps),
        simFps: Math.round(next.simFps),
      });
    };
    nes.onAudio = (frame) => audio.push(frame);
    nes.setDebug(debugRef.current);
    nes.setSpeed(Number(speedRef.current));
    audio.setSpeed(Number(speedRef.current));
    try {
      if (!nes.loadRom(rom.slice(0))) {
        const message = '无法识别的 ROM';
        if (onErrorRef.current) {
          onErrorRef.current(message);
        } else {
          setError(message);
        }
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : '加载失败';
      if (onErrorRef.current) {
        onErrorRef.current(message);
      } else {
        setError(message);
      }
    }
    audioRef.current = audio;
    nesRef.current = nes;
    const saveKey = romSaveKey(rom);
    setBattery(nes.hasBattery());
    let pending: Uint8Array | null = null;
    const flushSave = () => {
      if (!pending) {
        return;
      }
      const bytes = pending;
      pending = null;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void writeBattery(saveKey, bytes);
    };
    flushSaveRef.current = flushSave;
    nes.onSaveDirty = () => {
      const bytes = nes.exportSave();
      if (!bytes) {
        return;
      }
      pending = bytes;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(flushSave, 500);
    };
    if (nes.hasBattery()) {
      void readBattery(saveKey).then((saved) => {
        if (saved && nesRef.current === nes) {
          nes.importSave(saved);
        }
      }).catch(() => {
        // 读档失败时按无档继续
      });
    }
    const onHide = () => flushSave();
    window.addEventListener('pagehide', onHide);

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || menuOpenRef.current) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      const pressed = event.type === 'keydown';
      const button1 = PLAYER1_KEY_MAP[event.code];
      const button2 = PLAYER2_KEY_MAP[event.code];
      if (button1 === undefined && button2 === undefined) {
        return;
      }
      event.preventDefault();
      if (button1 !== undefined) {
        nes.setButton(1, button1, pressed);
      }
      if (button2 !== undefined) {
        nes.setButton(2, button2, pressed);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('pagehide', onHide);
      flushSave();
      flushSaveRef.current = () => {};
      nes.dispose();
      audio.dispose();
      nesRef.current = null;
      audioRef.current = null;
      setStarted(false);
      setPaused(true);
    };
  }, [rom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const nes = nesRef.current;
    if (!canvas || !stage || !nes) {
      return;
    }
    let cancelled = false;
    let presenter: NesPresenter | null = null;
    let observer: ResizeObserver | null = null;

    openPresenter(canvas, renderer).then((next) => {
      if (cancelled) {
        next.dispose();
        return;
      }
      next.setAspect(aspectRef.current);
      next.setPixelScale(toPixelScale(scaleRef.current));
      presenter = next;
      screenRef.current = next;
      drawRef.current = (frame) => next.draw(frame);
      const rect = stage.getBoundingClientRect();
      next.resize(rect.width, rect.height);
      nes.requestKeyframe();
      nes.redraw();
      observer = new ResizeObserver(() => {
        const box = stage.getBoundingClientRect();
        next.resize(box.width, box.height);
        nes.redraw();
      });
      observer.observe(stage);
    }).catch(() => {
      if (!cancelled && renderer !== '2d') {
        setRenderer('2d');
      }
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      presenter?.dispose();
      drawRef.current = () => {};
      if (screenRef.current === presenter) {
        screenRef.current = null;
      }
    };
  }, [renderer]);

  useEffect(() => {
    screenRef.current?.setAspect(aspect);
    nesRef.current?.redraw();
  }, [aspect]);

  useEffect(() => {
    screenRef.current?.setPixelScale(toPixelScale(scale));
    nesRef.current?.redraw();
  }, [scale]);

  useEffect(() => {
    nesRef.current?.setDebug(debug);
  }, [debug]);

  function clearSave() {
    const nes = nesRef.current;
    if (!nes) {
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    flushSaveRef.current = () => {};
    const key = romSaveKey(rom);
    void deleteBattery(key).finally(() => {
      if (nesRef.current !== nes) {
        return;
      }
      nes.loadRom(rom.slice(0));
      nes.requestKeyframe();
      nes.redraw();
    });
  }

  function applySpeed(value: string) {
    setSpeed(value);
    const multiplier = Number(value);
    nesRef.current?.setSpeed(multiplier);
    audioRef.current?.setSpeed(multiplier);
  }

  function begin() {
    const audio = audioRef.current;
    const nes = nesRef.current;
    if (!audio || !nes) {
      return;
    }
    audio.unlock();
    audio.setSpeed(Number(speedRef.current));
    audio.resume();
    nes.setSpeed(Number(speedRef.current));
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
      audioRef.current?.setSpeed(Number(speedRef.current));
      audioRef.current?.resume();
      nesRef.current?.start();
      setPaused(false);
    } else {
      nesRef.current?.pause();
      audioRef.current?.pause();
      setPaused(true);
    }
  }

  const pauseLabel = !started ? '开始' : paused ? '继续' : '暂停';

  return (
    <PlayShell
      title={title}
      coverUrl={started ? null : coverUrl}
      stageRef={stageRef}
      stageStyle={stageStyle(aspect)}
      onMenu={() => setMenuOpen(true)}
      onButton={(button, pressed) => {
        nesRef.current?.setButton(1, PAD_TO_NES[button], pressed);
      }}
      stage={
        <>
          <canvas key={renderer} ref={canvasRef} />
          {debug && started ? (
            <p className="fps-debug">画面 {stats.presentFps} · 模拟 {stats.simFps}</p>
          ) : null}
          {error ? (
            <div className="stage-overlay">
              <Text color="red">{error}</Text>
            </div>
          ) : started ? null : (
            <div className="stage-overlay">
              <Button size="3" onClick={begin}>开始</Button>
            </div>
          )}
        </>
      }
      menu={
      <Drawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={title}
        description="键盘：J / L 为 A / B，W A S D 方向，Q / E 为 Select / Start"
      >
        {error ? <Text color="red">{error}</Text> : null}
        <Button onClick={togglePause}>{pauseLabel}</Button>
        <Button variant={debug ? 'solid' : 'soft'} onClick={() => setDebug((on) => !on)}>
          {debug ? '调试：开' : '调试：关'}
        </Button>
        {battery ? (
          <Button variant="soft" color="gray" onClick={clearSave}>清除存档</Button>
        ) : null}
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">倍速</Text>
          <Select.Root value={speed} onValueChange={applySpeed}>
            <Select.Trigger style={{ width: '100%' }} />
            <MenuSelect>
              <Select.Item value="1">1x</Select.Item>
              <Select.Item value="2">2x</Select.Item>
              <Select.Item value="3">3x</Select.Item>
              <Select.Item value="4">4x</Select.Item>
            </MenuSelect>
          </Select.Root>
        </Flex>
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">像素</Text>
          <Select.Root value={scale} onValueChange={setScale}>
            <Select.Trigger style={{ width: '100%' }} />
            <MenuSelect>
              <Select.Item value="fit">适应</Select.Item>
              <Select.Item value="1">1x</Select.Item>
              <Select.Item value="2">2x</Select.Item>
              <Select.Item value="3">3x</Select.Item>
              <Select.Item value="4">4x</Select.Item>
            </MenuSelect>
          </Select.Root>
        </Flex>
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">渲染</Text>
          <Select.Root value={renderer} onValueChange={(value) => setRenderer(value as NesRendererKind)}>
            <Select.Trigger style={{ width: '100%' }} />
            <MenuSelect>
              {renderers.map((kind) => (
                <Select.Item key={kind} value={kind}>{RENDERER_LABEL[kind]}</Select.Item>
              ))}
            </MenuSelect>
          </Select.Root>
        </Flex>
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">画面</Text>
          <Select.Root value={aspect} onValueChange={(value) => setAspect(value as NesAspect)}>
            <Select.Trigger style={{ width: '100%' }} />
            <MenuSelect>
              <Select.Item value="16:9">16:9</Select.Item>
              <Select.Item value="4:3">4:3</Select.Item>
              <Select.Item value="native">原始</Select.Item>
            </MenuSelect>
          </Select.Root>
        </Flex>
        <Button asChild variant="soft" color="gray">
          <Link href="/">返回首页</Link>
        </Button>
      </Drawer>
      }
    />
  );
}
