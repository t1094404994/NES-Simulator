import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = reason?.trim() || '加载失败';

  return (
    <Flex className="page-shell error-page" direction="column" align="center" justify="center" gap="4">
      <img src="/icon.svg" alt="" width={64} height={64} />
      <Heading size="6">无法开始游戏</Heading>
      <Text size="3" color="gray" align="center" className="error-reason">{message}</Text>
      <Button asChild size="3">
        <Link href="/">返回首页</Link>
      </Button>
    </Flex>
  );
}
