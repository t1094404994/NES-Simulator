'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export function HardLink({
  href,
  children,
  style,
}: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  function go(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.assign(href);
  }

  return <a href={href} style={style} onClick={go}>{children}</a>;
}
