import '@radix-ui/themes/styles.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import { TrackVisit } from '@/components/TrackVisit';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  keywords: ['NES', 'FC', '红白机', '模拟器', '在线游戏'],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/icon.svg', alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/icon.svg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111111',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <TrackVisit />
          {children}
        </Providers>
      </body>
    </html>
  );
}
