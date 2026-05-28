/**
 * Testes de integracao da rota GET /executions/:execucaoId/suggestions
 * (schema v5 — recall-suggestions).
 *
 * Constroi uma base v5 minima (schema_version='5', 1 execucao, tabela
 * `suggestions`) em tmpdir e exercita: listagem por execucao, coercao de
 * severidade/referencias no mapper, conteudo UNTRUSTED cru, e degradacao
 * graciosa numa base v3 SEM a tabela (Principio II → [] sem degradar).
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
  const dir = mkdtempSync(join(tmpdir(), 'cstk-sug-'));
  const p = join(dir, name);
  toClean.push(p);
  return p;
}

/** Cria uma base v5 valida com 1 execucao e 2 sugestoes. */
function makeV5Db(path: string): void {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO schema_meta VALUES ('schema_version', '5');

    CREATE TABLE executions (
      execucao_id TEXT PRIMARY KEY, project TEXT, feature TEXT, status TEXT,
      ingested_at TEXT
    );
    INSERT INTO executions (execucao_id, project, feature, status, ingested_at)
    VALUES ('exec-001', 'cstk', 'recall-suggestions', 'concluida', '2026-05-27T18:00:00Z');

    CREATE TABLE suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT NOT NULL, feature TEXT NOT NULL, wave TEXT NOT NULL,
      execucao_id TEXT NOT NULL, source_ts TEXT NOT NULL, source_id TEXT NOT NULL,
      skill_afetada TEXT, severidade TEXT, diagnostico TEXT, proposta TEXT,
      referencias TEXT, issue_aberta TEXT, ingested_at TEXT NOT NULL,
      UNIQUE(project, feature, wave, source_id)
    );
    INSERT INTO suggestions
      (project, feature, wave, execucao_id, source_ts, source_id, skill_afetada,
       severidade, diagnostico, proposta, referencias, issue_aberta, ingested_at)
    VALUES
      ('cstk', 'recall-suggestions', '-', 'exec-001', '2026-05-27T10:00:00Z',
       'sug-001', 'execute-task', 'aviso',
       'O gate de lint nao roda em arquivos <script>x</script> .mjs',
       'Estender o glob do lint para .mjs', 'cli/lib/recall.sh,docs/spec.md', NULL,
       '2026-05-27T18:00:00Z'),
      ('cstk', 'recall-suggestions', '-', 'exec-001', '2026-05-27T11:00:00Z',
       'sug-002', 'review-task', 'impeditiva',
       'Severidade desconhecida deve degradar para null no painel',
       'Adicionar coercao no mapper', '', 'https://gh/x/issues/42',
       '2026-05-27T18:00:00Z');
  `);
  db.close();
}

/** Base v3 SEM a tabela suggestions — exercita a tolerancia de schema. */
function makeV3Db(path: string): void {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO schema_meta VALUES ('schema_version', '3');
    CREATE TABLE executions (
      execucao_id TEXT PRIMARY KEY, project TEXT, feature TEXT, status TEXT,
      ingested_at TEXT
    );
    INSERT INTO executions (execucao_id, project, feature, status, ingested_at)
    VALUES ('exec-001', 'cstk', 'old', 'concluida', '2026-05-27T18:00:00Z');
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

interface SuggestionsBody {
  data: Array<{
    execucaoId: string;
    sourceId: string;
    skillAfetada: string | null;
    severidade: string | null;
    diagnostico: string | null;
    proposta: string | null;
    referencias: string[];
    issueAberta: string | null;
    criadaEm: string | null;
  }> | null;
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

describe('GET /executions/:id/suggestions — base v5 com tabela suggestions', () => {
  let server: FastifyInstance;
  const dbPath = tmpFile('knowledge-v5.db');

  beforeAll(async () => {
    makeV5Db(dbPath);
    server = await buildServer(dbPath);
  });
  afterAll(async () => { await server.close(); });

  it('lista as sugestoes da execucao em ordem cronologica (200, nao-degradado)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/suggestions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<SuggestionsBody>();
    expect(body.meta.degraded).toBe(false);
    expect(body.meta.schemaVersion).toBe('5');
    expect(body.data).not.toBeNull();
    expect(body.data!.map((s) => s.sourceId)).toEqual(['sug-001', 'sug-002']);
  });

  it('divide referencias (CSV) em array; vazio → []', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/suggestions' });
    const body = res.json<SuggestionsBody>();
    const s1 = body.data!.find((s) => s.sourceId === 'sug-001')!;
    const s2 = body.data!.find((s) => s.sourceId === 'sug-002')!;
    expect(s1.referencias).toEqual(['cli/lib/recall.sh', 'docs/spec.md']);
    expect(s2.referencias).toEqual([]);
  });

  it('preserva severidade conhecida e mapeia issue_aberta', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/suggestions' });
    const body = res.json<SuggestionsBody>();
    const s2 = body.data!.find((s) => s.sourceId === 'sug-002')!;
    expect(s2.severidade).toBe('impeditiva');
    expect(s2.issueAberta).toBe('https://gh/x/issues/42');
    expect(body.data!.find((s) => s.sourceId === 'sug-001')!.issueAberta).toBeNull();
  });

  it('diagnostico chega cru (UNTRUSTED) — sem escapar markup', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/suggestions' });
    const body = res.json<SuggestionsBody>();
    const s1 = body.data!.find((s) => s.sourceId === 'sug-001')!;
    expect(s1.diagnostico).toContain('<script>x</script>');
  });
});

describe('GET /executions/:id/suggestions — base v3 SEM a tabela (Principio II)', () => {
  let server: FastifyInstance;
  const dbPath = tmpFile('knowledge-v3.db');

  beforeAll(async () => {
    makeV3Db(dbPath);
    server = await buildServer(dbPath);
  });
  afterAll(async () => { await server.close(); });

  it('retorna [] sem degradar quando a tabela suggestions nao existe', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/executions/exec-001/suggestions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<SuggestionsBody>();
    expect(body.meta.degraded).toBe(false);
    expect(body.data).toEqual([]);
  });
});
