'use client';

import { Flex, Heading } from '@radix-ui/themes';
import Link from 'next/link';

export function SiteHeader() {
  return (
    <Flex className="site-header" align="center" justify="between" px="4" py="3" style={{ borderBottom: '1px solid #333' }}>
      <Heading size="5">
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <img src="/icon.svg" alt="" width={28} height={28} />
          NES
        </Link>
      </Heading>
      <Flex gap="4">
        <Link href="/play/local">本地 ROM</Link>
      </Flex>
    </Flex>
  );
}
