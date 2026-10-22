import type { MetadataRoute } from 'next';
import { fetchGames } from '@/lib/games';
import { locales, localePath, type Locale } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';

function localizedUrl(locale: Locale, path: string): string {
  const localized = localePath(locale, path);
  if (localized === '/') {
    return SITE_URL;
  }
  return `${SITE_URL}${localized}`;
}

function languageLinks(path: string): Record<string, string> {
  return {
    'zh-CN': localizedUrl('zh', path),
    en: localizedUrl('en', path),
    'x-default': localizedUrl('zh', path),
  };
}

function addPath(
  pages: MetadataRoute.Sitemap,
  path: string,
  lastModified: Date,
  changeFrequency: 'daily' | 'weekly' | 'monthly',
  priority: number,
) {
  for (const locale of locales) {
    pages.push({
      url: localizedUrl(locale, path),
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages: languageLinks(path) },
    });
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [];
  addPath(pages, '/', now, 'daily', 1);
  addPath(pages, '/play/local', now, 'monthly', 0.6);
  const games = await fetchGames();
  if (!games) {
    return pages;
  }
  for (const game of games) {
    addPath(pages, `/play/${game.id}`, new Date(game.createdAt), 'weekly', 0.8);
  }
  return pages;
}
