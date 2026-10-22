import { cache } from 'react';
import { api, type GameItem } from '@/lib/api';

const REVALIDATE_SECONDS = 300;

export const fetchGames = cache(async (): Promise<GameItem[] | null> => {
  try {
    const response = await fetch(api.games(), { next: { revalidate: REVALIDATE_SECONDS } });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as GameItem[];
  } catch {
    return null;
  }
});

export const fetchGame = cache(async (id: string): Promise<GameItem | null> => {
  const response = await fetch(api.game(id), { next: { revalidate: REVALIDATE_SECONDS } });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`游戏信息加载失败 (${response.status})`);
  }
  return (await response.json()) as GameItem;
});
