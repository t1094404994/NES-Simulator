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
  type NesAspect,
  type NesFrame,
  type NesPixelScale,
  type NesPresenter,
  type NesRendererKind,
} from 'nes-simulator';
import { useEffect, useRef, useState } from 'react';
import { VirtualPad } from './VirtualPad';

const ASPECT_RATIO: Record<NesAspect, string> = {
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  native: '256 / 240',
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

export function Emulator({ rom, title }: { rom: ArrayBuffer; title: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nesRef = useRef<Nes | null>(null);
  const screenRef = useRef<NesPresenter | null>(null);
  const audioRef = useRef<NesAudioOut | null>(null);
  const drawRef = useRef<(frame: NesFrame) => void>(() => {});
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState('1');
  const [scale, setScale] = useState('fit');
  const [aspect, setAspect] = useState<NesAspect>('16:9');
  const [error, setError] = useState('');
  const [renderer, setRenderer] = useState<NesRendererKind>('2d');
  const [renderers, setRenderers] = useState<NesRendererKind[]>(['2d']);
  const speedRef = useRef(speed);
  const scaleRef = useRef(scale);
  const aspectRef = useRef(aspect);
  speedRef.current = speed;
  scaleRef.current = scale;
  aspectRef.current = aspect;

  useEffect(() => {
    const found = detectRenderers();
    setRenderers(found);
    setRenderer(found[0] ?? '2d');
  }, []);

  useEffect(() => {
    const audio = new NesAudioOut();
    const nes = new Nes();
    nes.onFrame = (frame) => drawRef.current(frame);
    nes.onAudio = (frame) => audio.push(frame);
    nes.setSpeed(Number(speedRef.current));
    audio.setSpeed(Number(speedRef.current));
    if (!nes.loadRom(rom.slice(0))) {
      setError('无法识别的 ROM');
    }
    audioRef.current = audio;
    nesRef.current = nes;

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) {
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

  return (
    <Flex direction="column" gap="3" p="4">
      <Text size="5" weight="bold">{title}</Text>
      {error ? <Text color="red">{error}</Text> : null}
      <div
        ref={stageRef}
        className="stage"
        style={{ aspectRatio: ASPECT_RATIO[aspect] }}
      >
        <canvas key={renderer} ref={canvasRef} />
        {started ? null : (
          <div className="stage-overlay">
            <Button size="3" onClick={begin}>开始</Button>
          </div>
        )}
      </div>
      <Flex gap="3" wrap="wrap" align="center" justify="center">
        <Button onClick={togglePause}>{paused ? '继续' : '暂停'}</Button>
        <Flex align="center" gap="2">
          <Text size="2">倍速</Text>
          <Select.Root value={speed} onValueChange={applySpeed}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="1">1x</Select.Item>
              <Select.Item value="2">2x</Select.Item>
              <Select.Item value="3">3x</Select.Item>
              <Select.Item value="4">4x</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex align="center" gap="2">
          <Text size="2">像素</Text>
          <Select.Root value={scale} onValueChange={setScale}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="fit">适应</Select.Item>
              <Select.Item value="1">1x</Select.Item>
              <Select.Item value="2">2x</Select.Item>
              <Select.Item value="3">3x</Select.Item>
              <Select.Item value="4">4x</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex align="center" gap="2">
          <Text size="2">渲染</Text>
          <Select.Root value={renderer} onValueChange={(value) => setRenderer(value as NesRendererKind)}>
            <Select.Trigger />
            <Select.Content>
              {renderers.map((kind) => (
                <Select.Item key={kind} value={kind}>{RENDERER_LABEL[kind]}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex align="center" gap="2">
          <Text size="2">画面</Text>
          <Select.Root value={aspect} onValueChange={(value) => setAspect(value as NesAspect)}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="16:9">16:9</Select.Item>
              <Select.Item value="4:3">4:3</Select.Item>
              <Select.Item value="native">原始</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Flex>
      <Text size="1" color="gray" align="center">
        键盘：J / L 为 A / B，W A S D 方向，Q / E 为 Select / Start
      </Text>
      <VirtualPad
        onButton={(button: NesButton, pressed: boolean) => {
          nesRef.current?.setButton(1, button, pressed);
        }}
      />
    </Flex>
  );
}
