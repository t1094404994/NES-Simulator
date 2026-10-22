import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';
import { localePath, messagesFor, resolveLocale, translateError } from '@/lib/i18n';

export default async function ErrorPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const locale = resolveLocale((await params).lang);
  const messages = messagesFor(locale);
  const { reason } = await searchParams;
  const message = translateError(reason?.trim() || 'LOAD_FAILED', messages);

  return (
    <Flex className="page-shell error-page" direction="column" align="center" justify="center" gap="4">
      <img src="/icon.svg" alt="" width={64} height={64} />
      <Heading size="6">{messages.cannotStart}</Heading>
      <Text size="3" color="gray" align="center" className="error-reason">{message}</Text>
      <Button asChild size="3">
        <Link href={localePath(locale, '/')}>{messages.backHome}</Link>
      </Button>
    </Flex>
  );
}
