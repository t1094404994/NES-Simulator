import type { MetadataRoute } from 'next';
import { api, type GameItem } from '@/lib/api';
import { SITE_URL } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/play/local`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];
  try {
    const response = await fetch(api.games(), { next: { revalidate: 3600 } });
    if (!response.ok) {
      return pages;
    }
    const games = (await response.json()) as GameItem[];
    for (const game of games) {
      pages.push({
        url: `${SITE_URL}/play/${game.id}`,
        lastModified: new Date(game.createdAt),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    return pages;
  }
  return pages;
}
