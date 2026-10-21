import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { GameStore, GameStoreError, coverContentType } from '@nes/db';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const SESSION_COOKIE = 'nes_admin';
const VISITOR_COOKIE = 'nes_vid';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const VISITOR_MAX_AGE = 365 * 24 * 60 * 60;
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(serverDir, '../data'));
const SOURCE_DIR = path.resolve(process.env.SOURCE_DIR || path.join(serverDir, '../../../source'));

const store = new GameStore(DATA_DIR);
await store.ready();
const seeded = await store.seedFromDirectory(SOURCE_DIR);
const adminCreated = await store.ensureAdmin();

const app = Fastify({ logger: true, trustProxy: true });
app.log.info({ sourceDir: SOURCE_DIR, ...seeded, adminCreated }, 'seeded source games');

const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

await app.register(cors, {
  origin: origins.includes('*') ? true : origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Nes-Visitor'],
});

await app.register(cookie);

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

function cookieOptions(request: FastifyRequest) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: request.protocol === 'https',
    path: '/',
  };
}

function readObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
}

async function requireAdmin(request: FastifyRequest) {
  const sessionId = request.cookies[SESSION_COOKIE];
  const user = sessionId ? await store.readSession(sessionId) : null;
  if (!user) {
    throw new GameStoreError('unauthorized', 401);
  }
  return user;
}

function headerValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value[0]) {
    return value[0];
  }
  return null;
}

function requestedVisitor(request: FastifyRequest): string | null {
  return request.cookies[VISITOR_COOKIE] || headerValue(request.headers['x-nes-visitor']);
}

function setVisitorCookie(request: FastifyRequest, reply: FastifyReply, visitorId: string) {
  reply.setCookie(VISITOR_COOKIE, visitorId, {
    ...cookieOptions(request),
    maxAge: VISITOR_MAX_AGE,
  });
}

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/games', async () => store.list());

app.get<{ Params: { id: string } }>('/api/games/:id', async (request) => {
  const game = await store.get(request.params.id);
  if (!game) {
    throw new GameStoreError('not found', 404);
  }
  return game;
});

app.get<{ Params: { id: string } }>('/api/games/:id/cover', async (request, reply) => {
  const cover = await store.readCover(request.params.id);
  if (!cover) {
    throw new GameStoreError('not found', 404);
  }
  return reply.type(coverContentType(cover.ext)).send(cover.data);
});

app.get<{ Params: { id: string } }>('/api/games/:id/rom', async (request, reply) => {
  const data = await store.readRom(request.params.id);
  if (!data) {
    throw new GameStoreError('not found', 404);
  }
  return reply
    .header('Content-Disposition', `attachment; filename="${request.params.id}.nes"`)
    .type('application/octet-stream')
    .send(data);
});

app.post('/api/track/visit', async (request, reply) => {
  const visitorId = await store.recordVisit(requestedVisitor(request));
  setVisitorCookie(request, reply, visitorId);
  return { ok: true, visitorId };
});

app.post('/api/track/play', async (request, reply) => {
  const body = readObject(request.body);
  const gameId = typeof body.gameId === 'string' ? body.gameId : '';
  const visitorId = await store.recordPlay(requestedVisitor(request), gameId);
  setVisitorCookie(request, reply, visitorId);
  return { ok: true, visitorId };
});

app.post('/api/admin/login', async (request, reply) => {
  const body = readObject(request.body);
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const user = await store.authenticate(email, password);
  const sessionId = await store.createSession(user.id);
  reply.setCookie(SESSION_COOKIE, sessionId, {
    ...cookieOptions(request),
    maxAge: SESSION_MAX_AGE,
  });
  return { email: user.email, role: user.role };
});

app.post('/api/admin/logout', async (request, reply) => {
  const sessionId = request.cookies[SESSION_COOKIE];
  if (sessionId) {
    await store.deleteSession(sessionId);
  }
  reply.clearCookie(SESSION_COOKIE, cookieOptions(request));
  return { ok: true };
});

app.get('/api/admin/me', async (request) => {
  const user = await requireAdmin(request);
  return { email: user.email, role: user.role };
});

app.get('/api/admin/stats', async (request) => {
  await requireAdmin(request);
  return store.stats();
});

app.post('/api/admin/games', async (request, reply) => {
  await requireAdmin(request);

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

app.put<{ Params: { id: string } }>('/api/admin/games/:id/cover', async (request) => {
  await requireAdmin(request);
  const file = await request.file();
  if (!file || file.fieldname !== 'cover') {
    throw new GameStoreError('cover is required', 400);
  }
  const data = await file.toBuffer();
  return store.updateCover(request.params.id, data, file.mimetype);
});

app.delete<{ Params: { id: string } }>('/api/admin/games/:id', async (request, reply) => {
  await requireAdmin(request);
  await store.remove(request.params.id);
  return reply.code(204).send();
});

await app.listen({ port: PORT, host: HOST });
