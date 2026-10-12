import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export async function migrateDatabase(databaseUrl: string, dataDir: string): Promise<void> {
  const prismaPkgPath = require.resolve('prisma/package.json');
  const prismaPkg = require(prismaPkgPath) as { bin?: { prisma?: string } };
  const bin = prismaPkg.bin?.prisma;
  if (!bin) {
    throw new Error('prisma cli is missing');
  }
  const entry = path.join(path.dirname(prismaPkgPath), bin);
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  await execFileAsync(process.execPath, [entry, 'migrate', 'deploy'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DATA_DIR: dataDir,
    },
  });
}
