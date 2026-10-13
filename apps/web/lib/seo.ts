import type { Metadata } from 'next';

export const SITE_NAME = 'NES Simulator';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nes-simulator.com';
export const SITE_DESCRIPTION = '在浏览器里玩 NES 游戏。浏览游戏库，或打开本地 ROM，无需安装。';

export function pageMeta(input: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  image?: string;
  imageAlt?: string;
}): Metadata {
  const index = input.index !== false;
  const fullTitle = input.title === SITE_NAME ? SITE_NAME : `${input.title} · ${SITE_NAME}`;
  const image = input.image ?? '/icon.svg';
  const imageAlt = input.imageAlt ?? input.title;
  return {
    title: input.title === SITE_NAME ? { absolute: SITE_NAME } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      siteName: SITE_NAME,
      title: fullTitle,
      description: input.description,
      url: input.path,
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: input.image ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description: input.description,
      images: [image],
    },
  };
}
