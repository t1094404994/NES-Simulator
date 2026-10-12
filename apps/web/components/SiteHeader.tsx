'use client';

import { Flex, Heading } from '@radix-ui/themes';
import Link from 'next/link';

export function SiteHeader() {
  return (
    <Flex align="center" justify="between" px="4" py="3" style={{ borderBottom: '1px solid #333' }}>
      <Heading size="5">
        <Link href="/">NES</Link>
      </Heading>
      <Flex gap="4">
        <Link href="/play/local">本地 ROM</Link>
        <Link href="/admin">管理</Link>
      </Flex>
    </Flex>
  );
}
