import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: '管理',
  description: '上传封面和 ROM，管理 NES 游戏库。',
  path: '/admin',
  index: false,
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
