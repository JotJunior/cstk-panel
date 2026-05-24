/**
 * Rota GET /health — saude do servidor e DB.
 * Ref: contracts/api-read.md §Saude e visao geral; spec.md FR-005, FR-014
 * Task 4.1.1
 *
 * Sempre retorna 200 — mesmo degradado (Principio II).
 * meta.degraded indica o estado do DB.
 */
import type { FastifyInstance } from 'fastify';
import { openDb } from '../db/open.js';
import { wrap, wrapDegraded } from '../lib/envelope.js';
import { generateETag, etagMatches } from '../lib/etag.js';
import { loadConfig } from '../config.js';

export interface HealthData {
  ok: boolean;
  dbReachable: boolean;
  quickCheck: boolean;
  counts: {
    executions: number;
    waves: number;
    decisions: number;
    tasks: number;
    events: number;
    alertSignals: number;
  };
}

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  const config = loadConfig();

  server.get('/health', async (request, reply) => {
    const openResult = openDb(config.dbPath);

    if (!openResult.ok) {
      const envelope = wrapDegraded(openResult.reason, config.dbPath);
      const responseData: HealthData = {
        ok: false,
        dbReachable: false,
        quickCheck: false,
        counts: { executions: 0, waves: 0, decisions: 0, tasks: 0, events: 0, alertSignals: 0 },
      };
      // Retornar shape valido mesmo degradado
      return reply.status(200).send({
        data: responseData,
        meta: envelope.meta,
      });
    }

    const { db } = openResult;
    try {
      // Contar entidades
      type CountRow = { n: number };
      const execCount = (db.prepare('SELECT count(*) as n FROM executions').get() as CountRow).n;
      const wavesCount = (db.prepare('SELECT count(*) as n FROM waves').get() as CountRow).n;
      const decisionsCount = (db.prepare('SELECT count(*) as n FROM decisions').get() as CountRow).n;

      // Tasks e events podem nao existir em todos os schemas v2
      let tasksCount = 0, eventsCount = 0, alertsCount = 0;
      try { tasksCount = (db.prepare('SELECT count(*) as n FROM tasks').get() as CountRow).n; } catch { /* ignorar */ }
      try { eventsCount = (db.prepare('SELECT count(*) as n FROM events').get() as CountRow).n; } catch { /* ignorar */ }
      try { alertsCount = (db.prepare('SELECT count(*) as n FROM alert_signals').get() as CountRow).n; } catch { /* ignorar */ }

      const data: HealthData = {
        ok: true,
        dbReachable: true,
        quickCheck: true,
        counts: {
          executions: execCount,
          waves: wavesCount,
          decisions: decisionsCount,
          tasks: tasksCount,
          events: eventsCount,
          alertSignals: alertsCount,
        },
      };

      const envelope = wrap(data, {}, config.dbPath, db);

      // ETag/304
      const etag = generateETag(envelope.meta.freshness);
      const ifNoneMatch = request.headers['if-none-match'] as string | undefined;
      if (etag && etagMatches(ifNoneMatch, etag)) {
        return reply.status(304).send();
      }
      if (etag) void reply.header('ETag', etag);

      return reply.status(200).send(envelope);
    } finally {
      db.close();
    }
  });
}
