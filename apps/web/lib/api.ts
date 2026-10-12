import { API, apiUrl, coverSrc as joinCover, type GameItem } from '@nes/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8787';

export type { GameItem };

export function coverSrc(coverUrl: string): string {
  return joinCover(API_BASE, coverUrl);
}

export const api = {
  games: () => apiUrl(API_BASE, API.games),
  game: (id: string) => apiUrl(API_BASE, API.game(id)),
  rom: (id: string) => apiUrl(API_BASE, API.rom(id)),
  adminGames: () => apiUrl(API_BASE, API.adminGames),
  adminGame: (id: string) => apiUrl(API_BASE, API.adminGame(id)),
};
