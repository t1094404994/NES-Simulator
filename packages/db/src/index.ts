import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { toGameItem, type GameItem } from '@nes/shared';
import { PrismaClient } from '../generated/prisma/client';
import { migrateDatabase } from './migrate';
import { seedSourceGames, type SeedResult } from './seed';

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COVER_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export class GameStoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface StoredGame extends GameItem {
  coverExt: string | null;
}

export function detectCoverExt(mime: string, data: Buffer): string | null {
  if (COVER_TYPES[mime]) {
    return COVER_TYPES[mime];
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'jpg';
  }
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return 'png';
  }
  if (data.length >= 6 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return 'gif';
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString() === 'RIFF' &&
    data.subarray(8, 12).toString() === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function coverContentType(ext: string): string {
  return Object.entries(COVER_TYPES).find(([, value]) => value === ext)?.[0] || 'application/octet-stream';
}

export function isInesRom(data: Buffer): boolean {
  return data.length >= 16 && data[0] === 0x4e && data[1] === 0x45 && data[2] === 0x53 && data[3] === 0x1a;
}

function toStored(row: { id: string; title: string; coverExt: string | null; createdAt: Date }): StoredGame {
  return {
    ...toGameItem({ id: row.id, title: row.title, createdAt: row.createdAt.getTime() }),
    coverExt: row.coverExt,
  };
}

/** Prisma + SQLite。封面和 ROM 存在游戏行里。 */
export class GameStore {
  private prisma: PrismaClient | null = null;
  readonly databaseUrl: string;

  constructor(private readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.databaseUrl = process.env.DATABASE_URL || `file:${path.join(dataDir, 'games.db')}`;
  }

  async ready(): Promise<void> {
    await migrateDatabase(this.databaseUrl, this.dataDir);
    this.prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: this.databaseUrl }),
    });
  }

  private db(): PrismaClient {
    if (!this.prisma) {
      throw new GameStoreError('store is not ready', 500);
    }
    return this.prisma;
  }

  async seedFromDirectory(sourceDir: string): Promise<SeedResult> {
    return seedSourceGames(this.db(), sourceDir);
  }

  async list(): Promise<StoredGame[]> {
    const rows = await this.db().game.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, coverExt: true, createdAt: true },
    });
    return rows.map(toStored);
  }

  async get(id: string): Promise<StoredGame | null> {
    this.assertId(id);
    const row = await this.db().game.findUnique({
      where: { id },
      select: { id: true, title: true, coverExt: true, createdAt: true },
    });
    return row ? toStored(row) : null;
  }

  async readCover(id: string): Promise<{ ext: string; data: Buffer } | null> {
    this.assertId(id);
    const row = await this.db().game.findUnique({
      where: { id },
      select: { cover: true, coverExt: true },
    });
    if (!row?.cover || !row.coverExt) {
      return null;
    }
    return { ext: row.coverExt, data: Buffer.from(row.cover) };
  }

  async readRom(id: string): Promise<Buffer | null> {
    this.assertId(id);
    const row = await this.db().game.findUnique({
      where: { id },
      select: { rom: true },
    });
    return row ? Buffer.from(row.rom) : null;
  }

  async create(input: { title: string; cover: Buffer; coverMime: string; rom: Buffer }): Promise<StoredGame> {
    const title = input.title.trim();
    if (!title || title.length > 80) {
      throw new GameStoreError('title is required (max 80)', 400);
    }
    const coverExt = detectCoverExt(input.coverMime, input.cover);
    if (!coverExt) {
      throw new GameStoreError('cover must be jpg, png, webp, or gif', 400);
    }
    if (!isInesRom(input.rom)) {
      throw new GameStoreError('rom is not an iNES file', 400);
    }

    const id = randomUUID();
    await this.db().game.create({
      data: {
        id,
        title,
        cover: new Uint8Array(input.cover),
        coverExt,
        rom: new Uint8Array(input.rom),
      },
    });
    const created = await this.get(id);
    if (!created) {
      throw new GameStoreError('failed to save game', 500);
    }
    return created;
  }

  async remove(id: string): Promise<StoredGame> {
    const game = await this.get(id);
    if (!game) {
      throw new GameStoreError('not found', 404);
    }
    await this.db().game.delete({ where: { id } });
    return game;
  }

  private assertId(id: string): void {
    if (!ID_RE.test(id)) {
      throw new GameStoreError('invalid id', 400);
    }
  }
}

export type { SeedResult };
