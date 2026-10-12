'use client';

import { Button, Flex, Select, Text } from '@radix-ui/themes';
import {
  Nes,
  NesAudioOut,
  NesButton,
  NesScreen,
  PLAYER1_KEY_MAP,
  PLAYER2_KEY_MAP,
  type NesAspect,
  type NesPixelScale,
} from 'nes-simulator';
import { useEffect, useRef, useState } from 'react';
import { VirtualPad } from './VirtualPad';

const ASPECT_RATIO: Record<NesAspect, string> = {
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  native: '256 / 240',
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
  const screenRef = useRef<NesScreen | null>(null);
  const audioRef = useRef<NesAudioOut | null>(null);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState('1');
  const [scale, setScale] = useState('fit');
  const [aspect, setAspect] = useState<NesAspect>('16:9');
  const [error, setError] = useState('');
  const speedRef = useRef(speed);
  const scaleRef = useRef(scale);
  const aspectRef = useRef(aspect);
  speedRef.current = speed;
  scaleRef.current = scale;
  aspectRef.current = aspect;

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) {
      return;
    }
    const screen = new NesScreen(canvas);
    const audio = new NesAudioOut();
    const nes = new Nes();
    screen.setAspect(aspectRef.current);
    screen.setPixelScale(toPixelScale(scaleRef.current));
    nes.onFrame = (frame) => screen.draw(frame);
    nes.onAudio = (frame) => audio.push(frame);
    nes.setSpeed(Number(speedRef.current));
    audio.setSpeed(Number(speedRef.current));
    if (!nes.loadRom(rom.slice(0))) {
      setError('无法识别的 ROM');
    }
    screenRef.current = screen;
    audioRef.current = audio;
    nesRef.current = nes;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      screen.resize(rect.width, rect.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

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
      observer.disconnect();
      nes.dispose();
      audio.dispose();
      nesRef.current = null;
      screenRef.current = null;
      audioRef.current = null;
      setStarted(false);
      setPaused(true);
    };
  }, [rom]);

  useEffect(() => {
    screenRef.current?.setAspect(aspect);
  }, [aspect]);

  useEffect(() => {
    screenRef.current?.setPixelScale(toPixelScale(scale));
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
        <canvas ref={canvasRef} />
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
