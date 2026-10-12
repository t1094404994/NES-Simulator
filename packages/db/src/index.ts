import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toGameItem, type GameItem } from '@nes/shared';
import Database from 'better-sqlite3';

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

interface GameRow {
  id: string;
  title: string;
  cover_ext: string;
  created_at: number;
}

export interface StoredGame extends GameItem {
  coverExt: string;
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

function toStored(row: GameRow): StoredGame {
  return {
    ...toGameItem({ id: row.id, title: row.title, createdAt: row.created_at }),
    coverExt: row.cover_ext,
  };
}

/** SQLite 游戏列表，封面和 ROM 放在 dataDir/files 下。 */
export class GameStore {
  private db: Database.Database;
  private filesDir: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filesDir = path.join(dataDir, 'files');
    mkdirSync(this.filesDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'games.db'));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        cover_ext TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  }

  async ready(): Promise<void> {
    await mkdir(this.filesDir, { recursive: true });
  }

  list(): StoredGame[] {
    const rows = this.db
      .prepare('SELECT id, title, cover_ext, created_at FROM games ORDER BY created_at DESC')
      .all() as GameRow[];
    return rows.map(toStored);
  }

  get(id: string): StoredGame | undefined {
    this.assertId(id);
    const row = this.db
      .prepare('SELECT id, title, cover_ext, created_at FROM games WHERE id = ?')
      .get(id) as GameRow | undefined;
    return row ? toStored(row) : undefined;
  }

  coverPath(game: StoredGame): string {
    return path.join(this.filesDir, game.id, `cover.${game.coverExt}`);
  }

  romPath(game: StoredGame): string {
    return path.join(this.filesDir, game.id, 'rom.nes');
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
    const dir = path.join(this.filesDir, id);
    await mkdir(dir, { recursive: true });
    try {
      await writeFile(path.join(dir, `cover.${coverExt}`), input.cover);
      await writeFile(path.join(dir, 'rom.nes'), input.rom);
      this.db
        .prepare('INSERT INTO games (id, title, cover_ext, created_at) VALUES (?, ?, ?, ?)')
        .run(id, title, coverExt, Date.now());
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
    const created = this.get(id);
    if (!created) {
      throw new GameStoreError('failed to save game', 500);
    }
    return created;
  }

  async remove(id: string): Promise<StoredGame> {
    const game = this.get(id);
    if (!game) {
      throw new GameStoreError('not found', 404);
    }
    this.db.prepare('DELETE FROM games WHERE id = ?').run(id);
    await rm(path.join(this.filesDir, id), { recursive: true, force: true });
    return game;
  }

  private assertId(id: string): void {
    if (!ID_RE.test(id)) {
      throw new GameStoreError('invalid id', 400);
    }
  }
}
