import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { GameStore, GameStoreError, coverContentType } from '@nes/db';
import Fastify from 'fastify';

const PORT = Number(process.env.PORT || 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token';
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(serverDir, '../data'));

function isAdmin(header: string | undefined): boolean {
  if (!header?.startsWith('Bearer ')) {
    return false;
  }
  return header.slice('Bearer '.length) === ADMIN_TOKEN;
}

const store = new GameStore(DATA_DIR);
await store.ready();

const app = Fastify({ logger: true });

const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

await app.register(cors, {
  origin: origins.includes('*') ? true : origins,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
});

await app.register(multipart, {
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 2,
  },
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof GameStoreError) {
    return reply.code(error.status).send({ error: error.message });
  }
  const known = error as { statusCode?: number; message?: string };
  const statusCode = typeof known.statusCode === 'number' ? known.statusCode : 500;
  return reply.code(statusCode).send({ error: known.message || 'internal error' });
});

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/games', async () => store.list());

app.get<{ Params: { id: string } }>('/api/games/:id', async (request) => {
  const game = store.get(request.params.id);
  if (!game) {
    throw new GameStoreError('not found', 404);
  }
  return game;
});

app.get<{ Params: { id: string } }>('/api/games/:id/cover', async (request, reply) => {
  const game = store.get(request.params.id);
  if (!game) {
    throw new GameStoreError('not found', 404);
  }
  return reply.type(coverContentType(game.coverExt)).send(createReadStream(store.coverPath(game)));
});

app.get<{ Params: { id: string } }>('/api/games/:id/rom', async (request, reply) => {
  const game = store.get(request.params.id);
  if (!game) {
    throw new GameStoreError('not found', 404);
  }
  const data = await readFile(store.romPath(game));
  return reply
    .header('Content-Disposition', `attachment; filename="${game.id}.nes"`)
    .type('application/octet-stream')
    .send(data);
});

app.post('/api/admin/games', async (request, reply) => {
  if (!isAdmin(request.headers.authorization)) {
    throw new GameStoreError('unauthorized', 401);
  }

  let title = '';
  let cover: { data: Buffer; mime: string } | null = null;
  let rom: Buffer | null = null;

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === 'file') {
      const data = await part.toBuffer();
      if (part.fieldname === 'cover') {
        cover = { data, mime: part.mimetype };
      } else if (part.fieldname === 'rom') {
        rom = data;
      }
    } else if (part.fieldname === 'title') {
      title = String(part.value || '');
    }
  }

  if (!cover || !rom) {
    throw new GameStoreError('cover and rom are required', 400);
  }
  const game = await store.create({ title, cover: cover.data, coverMime: cover.mime, rom });
  return reply.code(201).send(game);
});

app.delete<{ Params: { id: string } }>('/api/admin/games/:id', async (request, reply) => {
  if (!isAdmin(request.headers.authorization)) {
    throw new GameStoreError('unauthorized', 401);
  }
  await store.remove(request.params.id);
  return reply.code(204).send();
});

await app.listen({ port: PORT, host: '0.0.0.0' });
