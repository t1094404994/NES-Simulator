import { API, apiUrl, coverSrc as joinCover, type GameItem } from '@nes/shared';

export { API, apiUrl };

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
export const API_BASE = configuredApiBase == null
  ? 'http://127.0.0.1:8787'
  : configuredApiBase.replace(/\/$/, '');

export function serverApiBase(): string {
  const key = 'API_INTERNAL_BASE';
  const internal = process.env[key]?.replace(/\/$/, '');
  if (internal) {
    return internal;
  }
  if (API_BASE) {
    return API_BASE;
  }
  return 'http://127.0.0.1:8787';
}

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
  trackVisit: () => apiUrl(API_BASE, API.trackVisit),
  trackPlay: () => apiUrl(API_BASE, API.trackPlay),
};
