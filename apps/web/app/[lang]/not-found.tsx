import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { HardLink } from '@/components/HardLink';
import { SiteHeader } from '@/components/SiteHeader';
import { localePath, messagesFor, resolveLocale } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await headers()).get('x-locale') ?? undefined);
  const messages = messagesFor(locale);
  return pageMeta({
    title: messages.pageNotFoundTitle,
    description: messages.pageNotFoundDescription,
    path: '/404',
    locale,
    index: false,
  });
}

export default async function NotFound() {
  const locale = resolveLocale((await headers()).get('x-locale') ?? undefined);
  const messages = messagesFor(locale);
  return (
    <>
      <SiteHeader reload />
      <Flex className="page-shell error-page" direction="column" align="center" justify="center" gap="4">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <Heading size="9" color="orange">404</Heading>
        <Heading size="5">{messages.pageNotFoundTitle}</Heading>
        <Text size="3" color="gray" align="center" className="error-reason">
          {messages.pageNotFoundDescription}
        </Text>
        <Button asChild size="3">
          <HardLink href={localePath(locale, '/')}>{messages.backHome}</HardLink>
        </Button>
      </Flex>
    </>
  );
}
