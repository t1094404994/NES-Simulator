import { API, apiUrl, type AdminStats, type AdminUser, type GameItem } from '@nes/shared';

function messageFor(status: number, message: string, login: boolean): string {
  if (login && status === 403) {
    return '该账号不能登录管理后台';
  }
  if (login && (status === 401 || status === 400)) {
    return '邮箱或密码错误';
  }
  if (status === 401) {
    return '请重新登录';
  }
  if (status === 413) {
    return '文件过大，请小于 8MB';
  }
  if (message.includes('title')) {
    return '标题必填，且不超过 80 个字';
  }
  if (message.includes('cover')) {
    return '封面需要是 jpg、png、webp 或 gif';
  }
  if (message.includes('iNES') || message.includes('rom')) {
    return '请上传 iNES 格式的 .nes 文件';
  }
  if (message.includes('not found')) {
    return '找不到这款游戏';
  }
  return '操作失败';
}

async function readError(response: Response, login = false): Promise<string> {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return messageFor(response.status, data?.error || '', login);
}

async function request(path: string, init?: RequestInit, redirectOnUnauthorized = true): Promise<Response> {
  const response = await fetch(apiUrl('', path), {
    ...init,
    credentials: 'include',
    cache: 'no-store',
  });
  if (redirectOnUnauthorized && response.status === 401) {
    window.location.assign('/admin/login');
    return new Promise(() => {
      // 等浏览器跳到登录页，避免页面先画出失败状态。
    });
  }
  return response;
}

export async function currentUser(): Promise<AdminUser | null> {
  const response = await request(API.adminMe, undefined, false);
  if (!response.ok) {
    return null;
  }
  return response.json() as Promise<AdminUser>;
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const response = await request(API.adminLogin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, false);
  if (!response.ok) {
    throw new Error(await readError(response, true));
  }
  return response.json() as Promise<AdminUser>;
}

export async function logout(): Promise<void> {
  await request(API.adminLogout, { method: 'POST' }, false).catch(() => undefined);
}

export async function loadStats(): Promise<AdminStats> {
  const response = await request(API.adminStats);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<AdminStats>;
}

export async function listGames(): Promise<GameItem[]> {
  const response = await request(API.games);
  if (!response.ok) {
    throw new Error('游戏列表加载失败');
  }
  return response.json() as Promise<GameItem[]>;
}

export async function createGame(input: { title: string; rom: File; cover: File }): Promise<void> {
  const body = new FormData();
  body.set('title', input.title);
  body.set('rom', input.rom);
  body.set('cover', input.cover);
  const response = await request(API.adminGames, { method: 'POST', body });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function updateCover(id: string, cover: File): Promise<void> {
  const body = new FormData();
  body.set('cover', cover);
  const response = await request(API.adminGameCover(id), { method: 'PUT', body });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function removeGame(id: string): Promise<void> {
  const response = await request(API.adminGame(id), { method: 'DELETE' });
  if (!response.ok && response.status !== 204) {
    throw new Error(await readError(response));
  }
}

export function formatDateTime(value: number | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}
