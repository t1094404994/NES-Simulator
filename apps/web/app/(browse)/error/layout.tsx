import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: '加载失败',
  description: '这款 NES 游戏暂时无法在浏览器中运行。',
  path: '/error',
  index: false,
});

export default function ErrorLayout({ children }: { children: ReactNode }) {
  return children;
}
