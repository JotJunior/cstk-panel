/**
 * Rota GET /alerts — alertas cross-execucao.
 * Ref: contracts/api-read.md §Cross-execucao; spec.md FR-009
 * Task 4.4.1
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { openDb } from '../db/open.js';
import { wrap, wrapDegraded } from '../lib/envelope.js';
import { generateETag, etagMatches } from '../lib/etag.js';
import { loadConfig } from '../config.js';
import { safeParsePagination } from '../lib/pagination.js';
import { listCrossAlerts, countCrossAlerts } from '../db/queries/cross.js';
import type { Period } from '../db/queries/cross.js';

const QuerySchema = z.object({
  tipo: z.string().optional(),
  project: z.string().optional(),
  feature: z.string().optional(),
  period: z.enum(['24h', '7d', '30d', 'all']).optional(),
});

export async function alertRoutes(server: FastifyInstance): Promise<void> {
  const config = loadConfig();

  server.get('/alerts', async (request, reply) => {
    const qResult = QuerySchema.safeParse(request.query);
    const { tipo, project, feature, period } = qResult.success
      ? qResult.data
      : { tipo: undefined, project: undefined, feature: undefined, period: undefined };

    const pagination = safeParsePagination(request.query as Record<string, string | undefined>);

    const openResult = openDb(config.dbPath, config.supportedSchemaVersions);
    if (!openResult.ok) return reply.status(200).send(wrapDegraded(openResult.reason, config.dbPath));

    const { db } = openResult;
    try {
      const filters: import('../db/queries/cross.js').CrossAlertFilters = {
        ...pagination,
        ...(tipo !== undefined ? { tipo } : {}),
        ...(project !== undefined ? { project } : {}),
        ...(feature !== undefined ? { feature } : {}),
        ...(period !== undefined ? { period: period as Period } : {}),
      };
      const countFilters: Omit<import('../db/queries/cross.js').CrossAlertFilters, 'limit' | 'offset'> = {
        ...(tipo !== undefined ? { tipo } : {}),
        ...(project !== undefined ? { project } : {}),
        ...(feature !== undefined ? { feature } : {}),
        ...(period !== undefined ? { period: period as Period } : {}),
      };
      const rows = listCrossAlerts(db, filters);
      const total = countCrossAlerts(db, countFilters);

      const data = {
        alerts: rows.map(r => ({
          execucaoId: r.execucao_id,
          project: r.project,
          feature: r.feature,
          tipo: r.tipo,
          subtipo: r.subtipo,
          valorConsumido: r.valor_consumido,
          valorThreshold: r.valor_threshold,
          descricao: r.descricao,
          wave: r.wave,
        })),
        pagination: {
          total,
          limit: pagination.limit,
          offset: pagination.offset,
          hasMore: pagination.offset + rows.length < total,
        },
      };

      const envelope = wrap(data, {}, config.dbPath, db);
      const etag = generateETag(envelope.meta.freshness);
      const ifNoneMatch = request.headers['if-none-match'] as string | undefined;
      if (etag && etagMatches(ifNoneMatch, etag)) return reply.status(304).send();
      if (etag) void reply.header('ETag', etag);

      return reply.status(200).send(envelope);
    } finally { db.close(); }
  });
}
