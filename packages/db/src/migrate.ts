import { execFile } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const INIT_MIGRATION = '20261012061333_init';

export async function migrateDatabase(databaseUrl: string, dataDir: string): Promise<void> {
  try {
    await deploy(databaseUrl, dataDir);
  } catch (error) {
    if (!commandOutput(error).includes('P3005')) {
      throw error;
    }
    const file = sqliteFile(databaseUrl);
    const catalog = file ? inspectCatalog(file) : 'unknown';
    if (catalog === 'legacy' && file) {
      removeDatabase(file);
      await deploy(databaseUrl, dataDir);
      return;
    }
    if (catalog === 'current-without-history') {
      await resolveApplied(databaseUrl, dataDir, INIT_MIGRATION);
      await deploy(databaseUrl, dataDir);
      return;
    }
    throw error;
  }
}

async function deploy(databaseUrl: string, dataDir: string): Promise<void> {
  await prisma(databaseUrl, dataDir, ['migrate', 'deploy']);
}

async function resolveApplied(databaseUrl: string, dataDir: string, migration: string): Promise<void> {
  await prisma(databaseUrl, dataDir, ['migrate', 'resolve', '--applied', migration]);
}

async function prisma(databaseUrl: string, dataDir: string, args: string[]): Promise<void> {
  const prismaPkgPath = require.resolve('prisma/package.json');
  const prismaPkg = require(prismaPkgPath) as { bin?: { prisma?: string } };
  const bin = prismaPkg.bin?.prisma;
  if (!bin) {
    throw new Error('prisma cli is missing');
  }
  const entry = path.join(path.dirname(prismaPkgPath), bin);
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  await execFileAsync(process.execPath, [entry, ...args], {
    cwd: packageRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DATA_DIR: dataDir,
    },
  });
}

function sqliteFile(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith('file:')) {
    return null;
  }
  const file = databaseUrl.slice('file:'.length);
  return file || null;
}

type Catalog = 'legacy' | 'current-without-history' | 'unknown';

function inspectCatalog(file: string): Catalog {
  if (!existsSync(file)) {
    return 'unknown';
  }
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const names = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
        .map((row) => row.name),
    );
    if (names.has('_prisma_migrations')) {
      return 'unknown';
    }
    if (names.size === 1 && names.has('games')) {
      return 'legacy';
    }
    if (names.has('Game')) {
      return 'current-without-history';
    }
    return 'unknown';
  } finally {
    db.close();
  }
}

function removeDatabase(file: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const target = `${file}${suffix}`;
    if (existsSync(target)) {
      unlinkSync(target);
    }
  }
}

function commandOutput(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }
  const failed = error as { stdout?: unknown; stderr?: unknown; message?: unknown };
  return [failed.stderr, failed.stdout, failed.message].map((part) => {
    if (typeof part === 'string') {
      return part;
    }
    if (Buffer.isBuffer(part)) {
      return part.toString('utf8');
    }
    return '';
  }).join('\n');
}
