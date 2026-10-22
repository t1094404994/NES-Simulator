import { cache } from 'react';
import { API, apiUrl, serverApiBase, type GameItem } from '@/lib/api';

export const fetchGames = cache(async (): Promise<GameItem[] | null> => {
  try {
    const response = await fetch(apiUrl(serverApiBase(), API.games), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as GameItem[];
  } catch {
    return null;
  }
});

export const fetchGame = cache(async (id: string): Promise<GameItem | null> => {
  const response = await fetch(apiUrl(serverApiBase(), API.game(id)), { cache: 'no-store' });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`游戏信息加载失败 (${response.status})`);
  }
  return (await response.json()) as GameItem;
});
