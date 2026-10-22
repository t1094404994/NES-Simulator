'use client';

import { Flex, Spinner, Text } from '@radix-ui/themes';
import { useI18n } from '@/app/providers';

export function Loading({ label }: { label?: string }) {
  const { m } = useI18n();
  return (
    <Flex className="loading-screen" direction="column" align="center" justify="center" gap="3">
      <Spinner size="3" />
      <Text color="gray">{label ?? m.loading}</Text>
    </Flex>
  );
}
