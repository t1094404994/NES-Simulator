import type { GameItem } from '@/lib/api';
import { api } from '@/lib/api';

const games = new Map<string, GameItem>();
const roms = new Map<string, Promise<ArrayBuffer>>();
const romBuffers = new Map<string, ArrayBuffer>();
let lastId = '';
let emulatorReady: Promise<unknown> | null = null;

const LIMIT = 3;
let active = 0;
const queue: Array<() => void> = [];

function schedule(task: () => void) {
  if (active < LIMIT) {
    active += 1;
    task();
    return;
  }
  queue.push(task);
}

function finish() {
  active -= 1;
  const next = queue.shift();
  if (next) {
    active += 1;
    next();
  }
}

export function rememberGame(game: GameItem) {
  games.set(game.id, game);
  lastId = game.id;
}

export function peekGame(id: string): GameItem | null {
  if (id) {
    return games.get(id) ?? null;
  }
  return lastId ? games.get(lastId) ?? null : null;
}

export function peekRom(id: string): ArrayBuffer | null {
  return romBuffers.get(id) ?? null;
}

export function loadRom(id: string): Promise<ArrayBuffer> {
  const ready = romBuffers.get(id);
  if (ready) {
    return Promise.resolve(ready);
  }
  const pending = roms.get(id);
  if (pending) {
    return pending;
  }
  const next = new Promise<ArrayBuffer>((resolve, reject) => {
    schedule(() => {
      fetch(api.rom(id))
        .then((response) => {
          if (!response.ok) {
            throw new Error('ROM_DOWNLOAD_FAILED');
          }
          return response.arrayBuffer();
        })
        .then((buffer) => {
          romBuffers.set(id, buffer);
          resolve(buffer);
        })
        .catch((error: unknown) => {
          roms.delete(id);
          reject(error);
        })
        .finally(finish);
    });
  });
  roms.set(id, next);
  return next;
}

export function prefetchEmulator(): void {
  if (!emulatorReady) {
    emulatorReady = import('@/components/Emulator');
  }
}
