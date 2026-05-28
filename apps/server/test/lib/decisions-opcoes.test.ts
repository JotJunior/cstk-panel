/**
 * Testes de integracao da coluna `decisions.opcoes` (schema v6) na rota
 * GET /executions/:execucaoId/decisions.
 *
 * Constroi uma base v6 (com a coluna `opcoes`) e uma base v5 (SEM a coluna) em
 * tmpdir, exercitando: passagem crua do JSON array de opcoes, e degradacao
 * graciosa para `opcoes=null` em bases v<6 (Principio II / FR-V3-005), sem
 * quebrar o SELECT.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

const toClean: string[] = [];

function tmpFile(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'cstk-opt-'));
  const p = join(dir, name);
  toClean.push(p);
  return p;
}

const EXEC = `
  CREATE TABLE executions (
    execucao_id TEXT PRIMARY KEY, project TEXT, feature TEXT, status TEXT,
    ingested_at TEXT
  );
  INSERT INTO executions (execucao_id, project, feature, status, ingested_at)
  VALUES ('exec-001', 'cstk', 'recall', 'concluida', '2026-05-27T18:00:00Z');
`;

/** Base v6 com a coluna `opcoes` e 2 decisoes. */
function makeV6Db(path: string): void {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO schema_meta VALUES ('schema_version', '6');
    ${EXEC}
    CREATE TABLE decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT NOT NULL, feature TEXT NOT NULL, wave TEXT NOT NULL,
      execucao_id TEXT NOT NULL, source_ts TEXT NOT NULL, source_id TEXT NOT NULL,
      agente TEXT, etapa TEXT, escolha TEXT, opcoes TEXT, score INTEGER,
      contexto TEXT, justificativa TEXT, evidencia TEXT, ingested_at TEXT NOT NULL,
      UNIQUE(project, feature, wave, source_id)
    );
    INSERT INTO decisions
      (project, feature, wave, execucao_id, source_ts, source_id, agente, etapa,
       escolha, opcoes, score, contexto, justificativa, evidencia, ingested_at)
    VALUES
      ('cstk','recall','init','exec-001','2026-05-27T10:00:00Z','dec-001',
       'orchestrator','model-routing','model:sonnet',
       '["haiku","sonnet","opus","manter-atual"]', 0,
       'Selecao de modelo','sugerido=sonnet',NULL,'2026-05-27T18:00:00Z'),
      ('cstk','recall','onda-001','exec-001','2026-05-27T11:00:00Z','dec-002',
       'orchestrator','plan','proceder',
       '[]', 2,
       'Warm-up de permissoes','operador aprovou em batch',NULL,'2026-05-27T18:00:00Z');
  `);
  db.close();
}

/** Base v5 SEM a coluna `opcoes` — exercita a tolerancia de schema. */
function makeV5Db(path: string): void {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO schema_meta VALUES ('schema_version', '5');
    ${EXEC}
    CREATE TABLE decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT NOT NULL, feature TEXT NOT NULL, wave TEXT NOT NULL,
      execucao_id TEXT NOT NULL, source_ts TEXT NOT NULL, source_id TEXT NOT NULL,
      agente TEXT, etapa TEXT, escolha TEXT, score INTEGER,
      contexto TEXT, justificativa TEXT, evidencia TEXT, ingested_at TEXT NOT NULL,
      UNIQUE(project, feature, wave, source_id)
    );
    INSERT INTO decisions
      (project, feature, wave, execucao_id, source_ts, source_id, agente, etapa,
       escolha, score, contexto, justificativa, evidencia, ingested_at)
    VALUES
      ('cstk','recall','init','exec-001','2026-05-27T10:00:00Z','dec-001',
       'orchestrator','plan','proceder', 2,
       'ctx','just',NULL,'2026-05-27T18:00:00Z');
  `);
  db.close();
}

async function buildServer(dbPath: string): Promise<FastifyInstance> {
  process.env['CSTK_KNOWLEDGE_DB'] = dbPath;
  const server = Fastify({ logger: false });
  await server.register(cors, { origin: 'http://localhost:5173', methods: ['GET', 'OPTIONS'] });
  const { executionRoutes } = await import('../../src/routes/executions.js');
  await server.register(async (v1) => {
    await v1.register(executionRoutes);
  }, { prefix: '/api/v1' });
  await server.ready();
  return server;
}

interface DecisionsBody {
  data: {
    decisions: Array<{ escolha: string | null; opcoes: string | null }>;
  } | null;
  meta: { degraded: boolean; schemaVersion: string };
}

afterAll(() => {
  delete process.env['CSTK_KNOWLEDGE_DB'];
  for (const f of toClean) {
    try { unlinkSync(f); } catch { /* ignorar */ }
    try { unlinkSync(f + '-shm'); } catch { /* ignorar */ }
    try { unlinkSync(f + '-wal'); } catch { /* ignorar */ }
  }
});

describe('GET /executions/:id/decisions — base v6 com coluna opcoes', () => {
  let server: FastifyInstance;
  const dbPath = tmpFile('knowledge-v6.db');

  beforeAll(async () => {
    makeV6Db(dbPath);
    server = await buildServer(dbPath);
  });
  afterAll(async () => { await server.close(); });

  it('retorna o JSON array de opcoes cru (200, nao-degradado)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/decisions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<DecisionsBody>();
    expect(body.meta.degraded).toBe(false);
    expect(body.meta.schemaVersion).toBe('6');
    const d1 = body.data!.decisions[0]!;
    expect(d1.escolha).toBe('model:sonnet');
    expect(d1.opcoes).toBe('["haiku","sonnet","opus","manter-atual"]');
  });

  it('preserva array vazio "[]" como string crua', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/decisions' });
    const body = res.json<DecisionsBody>();
    expect(body.data!.decisions[1]!.opcoes).toBe('[]');
  });
});

describe('GET /executions/:id/decisions — base v5 SEM a coluna (Principio II)', () => {
  let server: FastifyInstance;
  const dbPath = tmpFile('knowledge-v5.db');

  beforeAll(async () => {
    makeV5Db(dbPath);
    server = await buildServer(dbPath);
  });
  afterAll(async () => { await server.close(); });

  it('degrada opcoes para null sem quebrar o SELECT', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/decisions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<DecisionsBody>();
    expect(body.meta.degraded).toBe(false);
    const d1 = body.data!.decisions[0]!;
    expect(d1.escolha).toBe('proceder');
    expect(d1.opcoes).toBeNull();
  });
});
