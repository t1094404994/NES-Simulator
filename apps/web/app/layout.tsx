import '@radix-ui/themes/styles.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'NES Simulator',
  description: 'NES 模拟器',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
