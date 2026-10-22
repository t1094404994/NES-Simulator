import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { messagesFor, resolveLocale } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';

type LocalLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: LocalLayoutProps): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  const messages = messagesFor(locale);
  return pageMeta({
    title: messages.localRom,
    description: messages.localRomDescription,
    path: '/play/local',
    locale,
  });
}

export default function LocalPlayLayout({ children }: { children: ReactNode }) {
  return children;
}
