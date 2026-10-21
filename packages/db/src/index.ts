import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { toGameItem, type AdminStats, type GameItem } from '@nes/shared';
import { PrismaClient } from '../generated/prisma/client';
import { migrateDatabase } from './migrate';
import { hashPassword, verifyPassword } from './password';
import { seedSourceGames, type SeedResult } from './seed';

const DEFAULT_ADMIN_EMAIL = 'txz@nes.com';
const DEFAULT_ADMIN_PASSWORD = 'fsdahieWarD213.Ak';
const ADMIN_ROLE = 'admin';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

function shanghaiDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isUniqueError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
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

  async updateCover(id: string, cover: Buffer, coverMime: string): Promise<StoredGame> {
    const game = await this.get(id);
    if (!game) {
      throw new GameStoreError('not found', 404);
    }
    const coverExt = detectCoverExt(coverMime, cover);
    if (!coverExt) {
      throw new GameStoreError('cover must be jpg, png, webp, or gif', 400);
    }
    await this.db().game.update({
      where: { id },
      data: { cover: new Uint8Array(cover), coverExt },
    });
    const updated = await this.get(id);
    if (!updated) {
      throw new GameStoreError('failed to save game', 500);
    }
    return updated;
  }

  /** 没有默认管理员时写入一次。已存在则保留现有密码。 */
  async ensureAdmin(): Promise<boolean> {
    const existing = await this.db().user.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL },
      select: { id: true },
    });
    if (existing) {
      return false;
    }
    try {
      await this.db().user.create({
        data: {
          id: randomUUID(),
          email: DEFAULT_ADMIN_EMAIL,
          passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD),
          role: ADMIN_ROLE,
        },
      });
      return true;
    } catch (error) {
      if (isUniqueError(error)) {
        return false;
      }
      throw error;
    }
  }

  async authenticate(email: string, password: string): Promise<SessionUser> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      throw new GameStoreError('unauthorized', 401);
    }
    const user = await this.db().user.findUnique({ where: { email: normalized } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new GameStoreError('unauthorized', 401);
    }
    if (user.role !== ADMIN_ROLE) {
      throw new GameStoreError('forbidden', 403);
    }
    return { id: user.id, email: user.email, role: user.role };
  }

  async createSession(userId: string): Promise<string> {
    const id = randomUUID();
    await this.db().session.create({
      data: {
        id,
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return id;
  }

  async readSession(id: string): Promise<SessionUser | null> {
    if (!ID_RE.test(id)) {
      return null;
    }
    const session = await this.db().session.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!session) {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now() || session.user.role !== ADMIN_ROLE) {
      await this.db().session.deleteMany({ where: { id } });
      return null;
    }
    return { id: session.user.id, email: session.user.email, role: session.user.role };
  }

  async deleteSession(id: string): Promise<void> {
    if (!ID_RE.test(id)) {
      return;
    }
    await this.db().session.deleteMany({ where: { id } });
  }

  /** 同一浏览器在上海时区的同一天只计一次访问。返回应写回的访客 id。 */
  async recordVisit(visitorId: string | null): Promise<string> {
    const id = await this.ensureVisitor(visitorId);
    const day = shanghaiDay();
    await this.db().visit.upsert({
      where: { visitorId_day: { visitorId: id, day } },
      create: { id: randomUUID(), visitorId: id, day },
      update: {},
    });
    await this.db().visitor.update({
      where: { id },
      data: { lastSeen: new Date() },
    });
    return id;
  }

  /** 成功打开一款游戏记一次游玩。返回应写回的访客 id。 */
  async recordPlay(visitorId: string | null, gameId: string): Promise<string> {
    this.assertId(gameId);
    const game = await this.get(gameId);
    if (!game) {
      throw new GameStoreError('not found', 404);
    }
    const id = await this.recordVisit(visitorId);
    await this.db().play.create({
      data: {
        id: randomUUID(),
        gameId,
        visitorId: id,
      },
    });
    return id;
  }

  async stats(): Promise<AdminStats> {
    const day = shanghaiDay();
    const [totalVisitors, todayVisits, totalPlays, games, grouped, playerGroups] = await Promise.all([
      this.db().visitor.count(),
      this.db().visit.count({ where: { day } }),
      this.db().play.count(),
      this.list(),
      this.db().play.groupBy({
        by: ['gameId'],
        _count: { id: true },
        _max: { createdAt: true },
      }),
      this.db().play.groupBy({
        by: ['gameId', 'visitorId'],
      }),
    ]);
    const playsByGame = new Map(grouped.map((row) => [row.gameId, row]));
    const playersByGame = new Map<string, number>();
    for (const row of playerGroups) {
      if (!row.visitorId) {
        continue;
      }
      playersByGame.set(row.gameId, (playersByGame.get(row.gameId) ?? 0) + 1);
    }
    const gameStats = games
      .map((game) => {
        const bucket = playsByGame.get(game.id);
        return {
          id: game.id,
          title: game.title,
          coverUrl: game.coverUrl,
          plays: bucket?._count.id ?? 0,
          players: playersByGame.get(game.id) ?? 0,
          lastPlayedAt: bucket?._max.createdAt ? bucket._max.createdAt.getTime() : null,
        };
      })
      .sort((left, right) => right.plays - left.plays || left.title.localeCompare(right.title, 'zh'));
    return {
      visitors: { total: totalVisitors, today: todayVisits },
      plays: { total: totalPlays },
      games: games.length,
      gameStats,
    };
  }

  private async ensureVisitor(visitorId: string | null): Promise<string> {
    if (visitorId && ID_RE.test(visitorId)) {
      const existing = await this.db().visitor.findUnique({
        where: { id: visitorId },
        select: { id: true },
      });
      if (existing) {
        return existing.id;
      }
      try {
        await this.db().visitor.create({
          data: { id: visitorId, lastSeen: new Date() },
        });
        return visitorId;
      } catch (error) {
        if (isUniqueError(error)) {
          return visitorId;
        }
        throw error;
      }
    }
    const id = randomUUID();
    await this.db().visitor.create({
      data: { id, lastSeen: new Date() },
    });
    return id;
  }

  private assertId(id: string): void {
    if (!ID_RE.test(id)) {
      throw new GameStoreError('invalid id', 400);
    }
  }
}

export type { SeedResult };
