import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { api, coverSrc, type GameItem } from '@/lib/api';
import { pageMeta } from '@/lib/seo';

type PlayLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PlayLayoutProps): Promise<Metadata> {
  const { id } = await params;
  const path = `/play/${id}`;
  const fallback = pageMeta({
    title: '游戏',
    description: '在浏览器中游玩这款 NES 游戏，打开即玩，无需安装。',
    path,
  });
  try {
    const response = await fetch(api.game(id), { next: { revalidate: 60 } });
    if (!response.ok) {
      return fallback;
    }
    const game = (await response.json()) as GameItem;
    const description = `在浏览器中游玩《${game.title}》，打开即玩，无需安装。`;
    return pageMeta({
      title: game.title,
      description,
      path,
      image: coverSrc(game.coverUrl),
      imageAlt: game.title,
    });
  } catch {
    return fallback;
  }
}

export default function PlayLayout({ children }: { children: ReactNode }) {
  return children;
}
