export interface GameItem {
  id: string;
  title: string;
  coverUrl: string;
  createdAt: number;
}

export const API = {
  health: '/api/health',
  games: '/api/games',
  game: (id: string) => `/api/games/${id}`,
  cover: (id: string) => `/api/games/${id}/cover`,
  rom: (id: string) => `/api/games/${id}/rom`,
  adminGames: '/api/admin/games',
  adminGame: (id: string) => `/api/admin/games/${id}`,
} as const;

export function apiUrl(base: string, path: string): string {
  const root = base.replace(/\/$/, '');
  return `${root}${path.startsWith('/') ? path : `/${path}`}`;
}

export function coverSrc(base: string, coverUrl: string): string {
  if (coverUrl.startsWith('http')) {
    return coverUrl;
  }
  return apiUrl(base, coverUrl);
}

export function toGameItem(game: { id: string; title: string; createdAt: number }): GameItem {
  return {
    id: game.id,
    title: game.title,
    coverUrl: API.cover(game.id),
    createdAt: game.createdAt,
  };
}
