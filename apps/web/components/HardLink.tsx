'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export function HardLink({
  href,
  children,
  style,
  current = false,
  className,
}: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
  current?: boolean;
  className?: string;
}) {
  function go(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.assign(href);
  }

  return (
    <a
      href={href}
      style={style}
      className={className}
      onClick={go}
      aria-current={current ? 'page' : undefined}
    >
      {children}
    </a>
  );
}
