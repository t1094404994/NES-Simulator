import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMeta } from '@/lib/seo';

type PlayLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PlayLayoutProps): Promise<Metadata> {
  const { id } = await params;
  return pageMeta({
    title: '游戏',
    description: '在浏览器中游玩这款 NES 游戏，打开即玩，无需安装。',
    path: `/play/${id}`,
  });
}

export default function PlayLayout({ children }: { children: ReactNode }) {
  return children;
}
