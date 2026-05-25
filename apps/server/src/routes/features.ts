/**
 * Rotas GET /features e GET /features/{project}/{feature}.
 * Ref: contracts/api-read.md §Projetos e features; spec.md FR-022
 * Task 4.2.2
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { openDb } from '../db/open.js';
import { wrap, wrapDegraded } from '../lib/envelope.js';
import { generateETag, etagMatches } from '../lib/etag.js';
import { loadConfig } from '../config.js';
import { getRollupByFeature, listExecutions } from '../db/queries/executions.js';
import { mapExecution } from '../mappers/index.js';

// Validacao de path params (FR-018 — sem traversal)
const FeatureParamSchema = z.object({
  project: z.string().min(1).max(200).regex(/^[^/\\.<>]+$/, 'invalid project'),
  feature: z.string().min(1).max(200).regex(/^[^/\\.<>]+$/, 'invalid feature'),
});

const FeatureQuerySchema = z.object({
  project: z.string().optional(),
  status: z.enum(['em_andamento', 'aguardando_humano', 'concluida', 'abortada']).optional(),
});

export async function featureRoutes(server: FastifyInstance): Promise<void> {
  const config = loadConfig();

  // GET /features?project=&status= — lista features com rollup
  server.get('/features', async (request, reply) => {
    const qResult = FeatureQuerySchema.safeParse(request.query);
    const { project, status } = qResult.success ? qResult.data : { project: undefined, status: undefined };

    const openResult = openDb(config.dbPath);
    if (!openResult.ok) {
      return reply.status(200).send(wrapDegraded(openResult.reason, config.dbPath));
    }

    const { db } = openResult;
    try {
      let features = getRollupByFeature(db);

      if (project) {
        features = features.filter(f => f.project === project);
      }
      if (status) {
        features = features.filter(f => f.latest_status === status);
      }

      const data = features.map(r => ({
        project: r.project,
        feature: r.feature,
        totalExecutions: r.total_executions,
        activeExecutions: r.active_executions,
        completedExecutions: r.completed_executions,
        abortedExecutions: r.aborted_executions,
        totalToolCalls: r.total_tool_calls,
        totalWallclock: r.total_wallclock,
        totalDecisions: r.total_decisions,
        totalOndas: r.total_ondas,
        totalBloqueios: r.total_bloqueios,
        etapaCorrente: r.etapa_corrente,
        openAlerts: r.open_alerts,
        latestStatus: r.latest_status,
        latestExecutionAt: r.latest_execution_at,
      }));

      const envelope = wrap(data, {}, config.dbPath, db);
      const etag = generateETag(envelope.meta.freshness);
      const ifNoneMatch = request.headers['if-none-match'] as string | undefined;
      if (etag && etagMatches(ifNoneMatch, etag)) return reply.status(304).send();
      if (etag) void reply.header('ETag', etag);

      return reply.status(200).send(envelope);
    } finally {
      db.close();
    }
  });

  // GET /features/:project/:feature — detalhe da feature com execucoes
  server.get('/features/:project/:feature', async (request, reply) => {
    const paramResult = FeatureParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.status(400).send({
        data: null,
        meta: { degraded: false, reason: null, freshness: { mtime: '', maxIngestedAt: '' }, schemaVersion: '2' },
        error: 'Invalid project or feature name',
      });
    }

    const { project, feature } = paramResult.data;
    const openResult = openDb(config.dbPath);
    if (!openResult.ok) {
      return reply.status(200).send(wrapDegraded(openResult.reason, config.dbPath));
    }

    const { db } = openResult;
    try {
      const allFeatures = getRollupByFeature(db);
      const featureRollup = allFeatures.find(r => r.project === project && r.feature === feature);

      if (!featureRollup) {
        // Inexistente != degradacao
        return reply.status(200).send(wrap(null, {}, config.dbPath, db));
      }

      // Execucoes da feature
      const allExecs = listExecutions(db);
      const executions = allExecs
        .filter(e => e.project === project && e.feature === feature)
        .map(mapExecution);

      const data = {
        project,
        feature,
        rollup: {
          totalExecutions: featureRollup.total_executions,
          activeExecutions: featureRollup.active_executions,
          completedExecutions: featureRollup.completed_executions,
          abortedExecutions: featureRollup.aborted_executions,
          totalToolCalls: featureRollup.total_tool_calls,
          totalWallclock: featureRollup.total_wallclock,
          totalDecisions: featureRollup.total_decisions,
          totalOndas: featureRollup.total_ondas,
          totalBloqueios: featureRollup.total_bloqueios,
          etapaCorrente: featureRollup.etapa_corrente,
          openAlerts: featureRollup.open_alerts,
          latestStatus: featureRollup.latest_status,
          latestExecutionAt: featureRollup.latest_execution_at,
        },
        executions,
      };

      const envelope = wrap(data, {}, config.dbPath, db);
      const etag = generateETag(envelope.meta.freshness);
      const ifNoneMatch = request.headers['if-none-match'] as string | undefined;
      if (etag && etagMatches(ifNoneMatch, etag)) return reply.status(304).send();
      if (etag) void reply.header('ETag', etag);

      return reply.status(200).send(envelope);
    } finally {
      db.close();
    }
  });
}
