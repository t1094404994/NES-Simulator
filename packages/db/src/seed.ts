import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client';
import { coverColor, solidPng } from './png';

const TITLES: Record<string, string> = {
  'dq-cn': '勇者斗恶龙',
  'ff3-cn': '最终幻想 III',
  'hudsons-adventure-island-cn': '冒险岛',
  'nekketsu-fighting-legend-cn': '热血格斗传说',
  'metal-gear': 'Metal Gear',
  'snow-bros': 'Snow Bros',
  'ninja-gaiden': 'Ninja Gaiden',
  'super-mario-bros-3': 'Super Mario Bros 3',
  'castlevania-ii-simons-quest': "Castlevania II: Simon's Quest",
  'double-dragon-ii-the-revenge': 'Double Dragon II: The Revenge',
};

export interface SeedResult {
  inserted: number;
  skipped: number;
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.nes$/i, '');
  if (TITLES[base]) {
    return TITLES[base];
  }
  if (/[A-Z ]/.test(base)) {
    return base;
  }
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function isInes(data: Buffer): boolean {
  return data.length >= 16 && data[0] === 0x4e && data[1] === 0x45 && data[2] === 0x53 && data[3] === 0x1a;
}

/** 把目录里的 .nes 写入游戏表。已经导入过的文件名会跳过。 */
export async function seedSourceGames(prisma: PrismaClient, sourceDir: string): Promise<SeedResult> {
  let names: string[];
  try {
    names = await readdir(sourceDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { inserted: 0, skipped: 0 };
    }
    throw error;
  }

  const files = names.filter((name) => name.toLowerCase().endsWith('.nes')).sort();
  let inserted = 0;
  let skipped = 0;
  for (const filename of files) {
    const existing = await prisma.game.findUnique({
      where: { sourceName: filename },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const rom = await readFile(path.join(sourceDir, filename));
    if (!isInes(rom)) {
      skipped += 1;
      continue;
    }
    const title = titleFromFilename(filename).slice(0, 80);
    await prisma.game.create({
      data: {
        id: randomUUID(),
        title,
        cover: new Uint8Array(solidPng(64, 64, coverColor(title))),
        coverExt: 'png',
        rom: new Uint8Array(rom),
        sourceName: filename,
      },
    });
    inserted += 1;
  }
  return { inserted, skipped };
}
