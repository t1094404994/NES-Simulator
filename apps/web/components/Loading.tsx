'use client';

import { Flex, Spinner, Text } from '@radix-ui/themes';

export function Loading({ label = '加载中' }: { label?: string }) {
  return (
    <Flex className="loading-screen" direction="column" align="center" justify="center" gap="3">
      <Spinner size="3" />
      <Text color="gray">{label}</Text>
    </Flex>
  );
}
