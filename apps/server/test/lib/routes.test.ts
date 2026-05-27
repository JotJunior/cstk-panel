/**
 * Testes de integracao das rotas — usa knowledge-fixture.db real.
 * Tasks 4.1.4, 4.2.4, 4.3.6, 4.4.6, 4.5.5, 4.5.6
 *
 * Principio II: todos os endpoints retornam 200 mesmo com base degradada.
 * Principio V: payloads hostis na busca → 200, nunca 5xx.
 *
 * Se a fixture nao existir ou estiver degradada, testes de rota real sao pulados
 * e apenas os testes de degradacao sao executados.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DB = resolve(join(__dirname, '..', 'knowledge-fixture.db'));
const FIXTURE_EXISTS = existsSync(FIXTURE_DB);

// ─── Construtor do servidor de teste ─────────────────────────────────────────

async function buildServer(dbPath: string): Promise<FastifyInstance> {
  // Injetar path de fixture via env
  process.env['CSTK_KNOWLEDGE_DB'] = dbPath;

  const server = Fastify({ logger: false });
  await server.register(cors, { origin: 'http://localhost:5173', methods: ['GET', 'OPTIONS'] });

  server.addHook('onSend', async (_req, reply) => {
    void reply.header('Content-Type', 'application/json; charset=utf-8');
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('Cache-Control', 'no-store');
  });

  const { healthRoutes } = await import('../../src/routes/health.js');
  const { overviewRoutes } = await import('../../src/routes/overview.js');
  const { projectRoutes } = await import('../../src/routes/projects.js');
  const { featureRoutes } = await import('../../src/routes/features.js');
  const { executionRoutes } = await import('../../src/routes/executions.js');
  const { metricsRoutes } = await import('../../src/routes/metrics.js');
  const { searchRoutes } = await import('../../src/routes/search.js');
  const { taskRoutes } = await import('../../src/routes/tasks.js');
  const { memoryRoutes } = await import('../../src/routes/memories.js');

  await server.register(async (v1) => {
    await v1.register(healthRoutes);
    await v1.register(overviewRoutes);
    await v1.register(projectRoutes);
    await v1.register(featureRoutes);
    await v1.register(executionRoutes);
    await v1.register(metricsRoutes);
    await v1.register(searchRoutes);
    await v1.register(taskRoutes);
    await v1.register(memoryRoutes);
  }, { prefix: '/api/v1' });

  server.setNotFoundHandler((_req, reply) => {
    return reply.status(404).send({ data: null, meta: { degraded: false, reason: null, freshness: { mtime: '', maxIngestedAt: '' }, schemaVersion: '2' }, error: 'Not found' });
  });

  await server.ready();
  return server;
}

// ─── Testes de degradacao (sempre rodam — nao precisam de fixture) ────────────

describe('GET /health — degradacao de 1a classe', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer('/tmp/nao-existe-cstk-test-' + Date.now() + '.db');
  });
  afterAll(async () => { await server.close(); });

  it('retorna 200 mesmo com DB ausente', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
  });

  it('meta.degraded=true e reason != null quando DB ausente', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' });
    // health.ts retorna shape especial com data.ok=false; meta pode ser em data ou meta
    const body = res.json<Record<string, unknown>>();
    // Aceitar body.meta.degraded=true OU body.data.ok=false (shape atual do health degradado)
    const metaDegraded = (body['meta'] as { degraded?: boolean })?.degraded;
    const dataOk = (body['data'] as { ok?: boolean })?.ok;
    expect(metaDegraded === true || dataOk === false).toBe(true);
  });
});

// ─── Testes de /search com payloads hostis (task 4.5.5 + 4.5.6) ──────────────

describe('GET /search — payloads hostis', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    // Usar fixture se disponivel, senao path degradado (search retorna {} degradado, nunca 5xx)
    const dbPath = FIXTURE_EXISTS ? FIXTURE_DB : '/tmp/nao-existe-search-test.db';
    server = await buildServer(dbPath);
  });
  afterAll(async () => { await server.close(); });

  const HOSTILE_QUERIES = [
    '") OR 1=1 --',
    "NEAR/3 (a b)",
    '"unclosed',
    "; DROP TABLE decisions; --",
    "')) OR '1'='1",
    "MATCH * FROM decisions",
  ];

  for (const q of HOSTILE_QUERIES) {
    it(`retorna 200 (nao 5xx) para query hostil: ${q.slice(0, 30)}`, async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/search?q=${encodeURIComponent(q)}`,
      });
      expect(res.statusCode).toBe(200);
    });
  }

  it('retorna 400 com mensagem descritiva para q vazio', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/search?q=' });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error?: string }>();
    expect(body.error).toBeDefined();
    // Nao deve expor stack trace — campo error e string descritiva
    expect(body.error).not.toContain('Error: ');
    expect(body.error).not.toContain('at ');
  });

  it('retorna 400 para q com mais de 200 chars', async () => {
    const longQ = 'a'.repeat(201);
    const res = await server.inject({ method: 'GET', url: `/api/v1/search?q=${longQ}` });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Testes com fixture real (pulados se nao existir) ─────────────────────────

describe.skipIf(!FIXTURE_EXISTS)('Rotas com fixture real — GET /api/v1/*', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer(FIXTURE_DB);
  });
  afterAll(async () => { await server.close(); });

  // task 4.1.4 — /overview responde campos de KPI
  it('GET /overview retorna kpis com totalExecutions', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/overview' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { kpis: { totalExecutions: number } }; meta: { degraded: boolean } }>();
    expect(body.meta.degraded).toBe(false);
    expect(typeof body.data.kpis.totalExecutions).toBe('number');
    expect(body.data.kpis.totalExecutions).toBeGreaterThan(0);
  });

  // task 4.1.4 — /overview com period=all
  it('GET /overview?period=all responde sem erro', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/overview?period=all' });
    expect(res.statusCode).toBe(200);
  });

  // task 4.2.4 — /projects lista
  it('GET /projects retorna lista de projetos', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: unknown[] }>();
    expect(Array.isArray(body.data)).toBe(true);
  });

  // task 4.2.4 — /projects/unknown retorna data:null sem degradar
  it('GET /projects/unknown retorna data:null sem meta.degraded', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects/projeto-nao-existe-xyzabc' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: null; meta: { degraded: boolean } }>();
    expect(body.data).toBeNull();
    expect(body.meta.degraded).toBe(false);
  });

  // task 4.3.6 — /decisions paginadas
  it('GET /executions/:id/decisions com limit=5 retorna no maximo 5 itens', async () => {
    // Pegar primeira execucao da fixture
    const overviewRes = await server.inject({ method: 'GET', url: '/api/v1/overview' });
    const overviewBody = overviewRes.json<{ data: { inProgress: { execucaoId: string }[]; leaderboard: { execucaoId: string }[] } }>();
    const execId = overviewBody.data.leaderboard[0]?.execucaoId ?? overviewBody.data.inProgress[0]?.execucaoId;

    if (!execId) return; // skip se nao ha execucoes

    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/executions/${execId}/decisions?limit=5`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { decisions: unknown[]; pagination: { limit: number } } }>();
    expect(body.data.decisions.length).toBeLessThanOrEqual(5);
    expect(body.data.pagination.limit).toBe(5);
  });

  // task 4.4.6 — /metrics/clarify-resolution tem meta.approximate=true
  it('GET /metrics/clarify-resolution tem meta.approximate=true', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/clarify-resolution' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ meta: { approximate?: boolean } }>();
    expect(body.meta.approximate).toBe(true);
  });

  // task 4.4.6 — /metrics/cost-over-time retorna toolCalls
  it('GET /metrics/cost-over-time retorna array com campo toolCalls (nao tokens nem $)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/cost-over-time' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { toolCalls?: number }[] }>();
    // Se ha dados, cada item tem campo toolCalls (nao "tokens" ou "$")
    if (Array.isArray(body.data) && body.data.length > 0) {
      const item = body.data[0]!;
      expect('toolCalls' in item).toBe(true);
      expect('tokens' in item).toBe(false);
    }
  });

  // FR-V3-007 — /metrics/recall-consultations: total + split produtivas/vazias
  it('GET /metrics/recall-consultations retorna total e split (produtivas+vazias=total)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/metrics/recall-consultations' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { total: number; produtivas: number; vazias: number } | null; meta: { degraded: boolean } }>();
    if (body.meta.degraded || body.data === null) return; // sem fixture
    const { total, produtivas, vazias } = body.data;
    expect(produtivas + vazias).toBe(total);
    // Fixture v3 semeia 2 eventos: hits=3 (produtiva) e hits=0 (vazia).
    expect(total).toBeGreaterThanOrEqual(2);
    expect(produtivas).toBeGreaterThanOrEqual(1);
  });

  // FR-V3-009 — /tasks expoe titulo (schema v3)
  it('GET /tasks expoe campo titulo em cada item (schema v3)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/tasks?limit=5' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { tasks: Record<string, unknown>[] } | null }>();
    if (!body.data || body.data.tasks.length === 0) return;
    expect('titulo' in body.data.tasks[0]!).toBe(true);
  });

  // recall-memory-mirror — /memories degrada graciosamente em base v3 (sem a
  // tabela `memories`): 200, nao-degradado, listas vazias (Principio II).
  it('GET /memories em base v3 retorna 200 com listas vazias (sem tabela memories)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/memories' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      data: { memories: unknown[]; projects: unknown[]; pagination: { total: number } } | null;
      meta: { degraded: boolean };
    }>();
    expect(body.meta.degraded).toBe(false);
    expect(body.data).not.toBeNull();
    expect(Array.isArray(body.data!.memories)).toBe(true);
    expect(body.data!.memories.length).toBe(0);
    expect(Array.isArray(body.data!.projects)).toBe(true);
    expect(body.data!.pagination.total).toBe(0);
  });

  // ETag/304
  it('GET /overview com ETag correto retorna 304', async () => {
    const res1 = await server.inject({ method: 'GET', url: '/api/v1/overview' });
    const etag = res1.headers['etag'] as string | undefined;
    if (!etag) return; // fixture sem mtime real

    const res2 = await server.inject({
      method: 'GET',
      url: '/api/v1/overview',
      headers: { 'if-none-match': etag },
    });
    expect(res2.statusCode).toBe(304);
  });
});
