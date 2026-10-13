import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: '本地 ROM',
  description: '选择本机 .nes 文件，在浏览器里直接游玩。文件不会上传。',
  path: '/play/local',
});

export default function LocalPlayLayout({ children }: { children: ReactNode }) {
  return children;
}
