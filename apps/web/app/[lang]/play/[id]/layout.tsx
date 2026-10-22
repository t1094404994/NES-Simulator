import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { fetchGame } from '@/lib/games';
import { messagesFor, resolveLocale } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';

type PlayLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string; id: string }>;
};

export async function generateMetadata({ params }: PlayLayoutProps): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = resolveLocale(lang);
  const messages = messagesFor(locale);
  const path = `/play/${id}`;
  try {
    const game = await fetchGame(id);
    if (!game) {
      return pageMeta({
        title: messages.gameNotFoundTitle,
        description: messages.gameNotFoundDescription,
        path,
        locale,
        index: false,
      });
    }
    return pageMeta({
      title: game.title,
      description: messages.playDescription(game.title),
      path,
      locale,
      image: game.coverUrl,
      imageAlt: game.title,
    });
  } catch {
    return pageMeta({
      title: messages.gameFallbackTitle,
      description: messages.playGeneric,
      path,
      locale,
    });
  }
}

export default function PlayLayout({ children }: { children: ReactNode }) {
  return children;
}
