import type { Metadata } from 'next';
import { localePath, ogLocale, type Locale } from '@/lib/i18n';

export const SITE_NAME = 'NES Simulator';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nes-simulator.com';

export function absoluteUrl(locale: Locale, path: string): string {
  const localized = localePath(locale, path);
  if (localized === '/') {
    return SITE_URL;
  }
  return `${SITE_URL}${localized}`;
}

export function languageAlternates(path: string): Record<string, string> {
  return {
    'zh-CN': localePath('zh', path),
    en: localePath('en', path),
    'x-default': localePath('zh', path),
  };
}

export function pageMeta(input: {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  index?: boolean;
  image?: string;
  imageAlt?: string;
}): Metadata {
  const index = input.index !== false;
  const fullTitle = input.title === SITE_NAME ? SITE_NAME : `${input.title} · ${SITE_NAME}`;
  const image = input.image ?? '/icon.svg';
  const imageAlt = input.imageAlt ?? input.title;
  const canonical = localePath(input.locale, input.path);
  return {
    title: input.title === SITE_NAME ? { absolute: SITE_NAME } : input.title,
    description: input.description,
    alternates: {
      canonical,
      languages: languageAlternates(input.path),
    },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: ogLocale(input.locale),
      alternateLocale: input.locale === 'zh' ? ['en_US'] : ['zh_CN'],
      siteName: SITE_NAME,
      title: fullTitle,
      description: input.description,
      url: canonical,
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
