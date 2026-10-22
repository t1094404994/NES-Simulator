'use client';

import { Flex, Heading } from '@radix-ui/themes';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { HardLink } from './HardLink';

const logoStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8 };

function Logo() {
  return (
    <>
      <img src="/icon.svg" alt="" width={28} height={28} />
      NES
    </>
  );
}

function NavLink({ href, reload, children, style }: { href: string; reload: boolean; children: ReactNode; style?: CSSProperties }) {
  if (reload) {
    return <HardLink href={href} style={style}>{children}</HardLink>;
  }
  return <Link href={href} style={style}>{children}</Link>;
}

export function SiteHeader({ reload = false }: { reload?: boolean }) {
  return (
    <Flex className="site-header" align="center" justify="between" px="4" py="3" style={{ borderBottom: '1px solid #333' }}>
      <Heading size="5">
        <NavLink href="/" reload={reload} style={logoStyle}>
          <Logo />
        </NavLink>
      </Heading>
      <Flex gap="4">
        <NavLink href="/play/local" reload={reload}>本地 ROM</NavLink>
      </Flex>
    </Flex>
  );
}
