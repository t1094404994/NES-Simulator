'use client';

import { NesButton } from 'nes-simulator';
import type { MouseEvent, PointerEvent } from 'react';

interface VirtualPadProps {
  onButton: (button: NesButton, pressed: boolean) => void;
}

function hold(
  button: NesButton,
  onButton: VirtualPadProps['onButton'],
): {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
} {
  const set = (pressed: boolean) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (pressed) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    onButton(button, pressed);
  };
  return {
    onPointerDown: set(true),
    onPointerUp: set(false),
    onPointerCancel: set(false),
    onPointerLeave: (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        onButton(button, false);
      }
    },
    onContextMenu: (event) => event.preventDefault(),
  };
}

export function VirtualPad({ onButton }: VirtualPadProps) {
  return (
    <div className="pad">
      <div className="dpad">
        <button type="button" className="pad-btn pad-up" {...hold(NesButton.UP, onButton)}>上</button>
        <button type="button" className="pad-btn pad-left" {...hold(NesButton.LEFT, onButton)}>左</button>
        <button type="button" className="pad-btn pad-right" {...hold(NesButton.RIGHT, onButton)}>右</button>
        <button type="button" className="pad-btn pad-down" {...hold(NesButton.DOWN, onButton)}>下</button>
      </div>
      <div className="menu-keys">
        <button type="button" className="pad-btn small" aria-label="Select" {...hold(NesButton.SELECT, onButton)}>−</button>
        <button type="button" className="pad-btn small" aria-label="Start" {...hold(NesButton.START, onButton)}>+</button>
      </div>
      <div className="action-keys">
        <button type="button" className="pad-btn round" {...hold(NesButton.B, onButton)}>B</button>
        <button type="button" className="pad-btn round" {...hold(NesButton.A, onButton)}>A</button>
      </div>
    </div>
  );
}
