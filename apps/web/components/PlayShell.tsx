'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode, Ref } from 'react';
import { VirtualPad, type PadButton } from './VirtualPad';

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="15" cy="7" r="1.6" fill="currentColor" />
      <circle cx="9" cy="12" r="1.6" fill="currentColor" />
      <circle cx="16" cy="17" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function PlayShell({
  title,
  coverUrl,
  stageRef,
  stageStyle,
  stage,
  onButton,
  onMenu,
  menu,
}: {
  title: string;
  coverUrl?: string | null;
  stageRef?: Ref<HTMLDivElement>;
  stageStyle?: CSSProperties;
  stage?: ReactNode;
  onButton?: (button: PadButton, pressed: boolean) => void;
  onMenu?: () => void;
  menu?: ReactNode;
}) {
  return (
    <div className="emulator">
      <div className="play-top">
        <Link href="/" className="play-icon-btn" aria-label="返回">
          <IconBack />
        </Link>
        <p className="play-title">{title}</p>
        <button type="button" className="play-icon-btn" aria-label="设置" onClick={onMenu} disabled={!onMenu}>
          <IconSettings />
        </button>
      </div>
      <div className="play-layout">
        <div className="stage-fit">
          <div ref={stageRef} className="stage" style={stageStyle}>
            {stage}
            {coverUrl ? <img className="stage-cover" src={coverUrl} alt="" /> : null}
          </div>
        </div>
        <VirtualPad onButton={onButton} />
      </div>
      {menu}
    </div>
  );
}
