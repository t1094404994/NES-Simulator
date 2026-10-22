import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { messagesFor, resolveLocale } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';

type ErrorLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: ErrorLayoutProps): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  const messages = messagesFor(locale);
  return pageMeta({
    title: messages.loadFailedTitle,
    description: messages.loadFailedDescription,
    path: '/error',
    locale,
    index: false,
  });
}

export default function ErrorLayout({ children }: { children: ReactNode }) {
  return children;
}
