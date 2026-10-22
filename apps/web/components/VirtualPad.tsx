'use client';

import type { MouseEvent, PointerEvent } from 'react';
import { useI18n } from '@/app/providers';

export type PadButton = 'up' | 'down' | 'left' | 'right' | 'select' | 'start' | 'a' | 'b';

interface VirtualPadProps {
  onButton?: (button: PadButton, pressed: boolean) => void;
}

function hold(button: PadButton, onButton: VirtualPadProps['onButton']) {
  const set = (pressed: boolean) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (pressed) {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (event.pointerType !== 'mouse') {
        navigator.vibrate?.(12);
      }
    }
    onButton?.(button, pressed);
  };
  return {
    onPointerDown: set(true),
    onPointerUp: set(false),
    onPointerCancel: set(false),
    onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        onButton?.(button, false);
      }
    },
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
  };
}

export function VirtualPad({ onButton }: VirtualPadProps) {
  const { m } = useI18n();
  return (
    <div className="pad">
      <div className="dpad">
        <button type="button" className="pad-btn pad-up" aria-label={m.padUp} {...hold('up', onButton)}>↑</button>
        <button type="button" className="pad-btn pad-left" aria-label={m.padLeft} {...hold('left', onButton)}>←</button>
        <button type="button" className="pad-btn pad-right" aria-label={m.padRight} {...hold('right', onButton)}>→</button>
        <button type="button" className="pad-btn pad-down" aria-label={m.padDown} {...hold('down', onButton)}>↓</button>
      </div>
      <div className="menu-keys">
        <button type="button" className="pad-btn small" aria-label="Select" {...hold('select', onButton)}>SELECT</button>
        <button type="button" className="pad-btn small" aria-label="Start" {...hold('start', onButton)}>START</button>
      </div>
      <div className="action-keys">
        <button type="button" className="pad-btn round pad-b" {...hold('b', onButton)}>B</button>
        <button type="button" className="pad-btn round pad-a" {...hold('a', onButton)}>A</button>
      </div>
    </div>
  );
}
