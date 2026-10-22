import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import type { Metadata } from 'next';
import { HardLink } from '@/components/HardLink';
import { SiteHeader } from '@/components/SiteHeader';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: '页面不存在',
  description: '这个地址没有对应的页面。',
  path: '/404',
  index: false,
});

export default function NotFound() {
  return (
    <>
      <SiteHeader reload />
      <Flex className="page-shell error-page" direction="column" align="center" justify="center" gap="4">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <Heading size="9" color="orange">404</Heading>
        <Heading size="5">页面不存在</Heading>
        <Text size="3" color="gray" align="center" className="error-reason">
          这个地址没有对应的页面。
        </Text>
        <Button asChild size="3">
          <HardLink href="/">返回首页</HardLink>
        </Button>
      </Flex>
    </>
  );
}
