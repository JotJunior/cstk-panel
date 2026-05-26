/**
 * Rota GET /overview — visao geral com KPIs, alertas, execucoes em andamento.
 * Ref: contracts/api-read.md §Saude e visao geral; spec.md FR-008, FR-022
 * Task 4.1.2
 *
 * Principio III (Honestidade de Metrica):
 * - toolCallsTotal = proxy de custo; NUNCA rotular como "$" ou "tokens" na UI.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { openDb } from '../db/open.js';
import { wrap, wrapDegraded } from '../lib/envelope.js';
import { generateETag, etagMatches } from '../lib/etag.js';
import { loadConfig } from '../config.js';
import {
  getOverviewKPIs, getRecentAlerts, getActiveExecutions,
  getModelMix, getRecentActivity, getCostSeries,
} from '../db/queries/overview.js';
import { getRollupByProject, getRollupByFeature } from '../db/queries/executions.js';

const PeriodSchema = z.enum(['24h', '7d', '30d', 'all']).optional().default('7d');
const QuerySchema = z.object({ period: PeriodSchema });

type AllExecRow = {
  project: string; feature: string; execucao_id: string; status: string | null;
  tool_calls_total: number | null; ondas_total: number | null;
  decisoes_total: number | null; iniciada_em: string | null; terminada_em: string | null;
};

function filterByPeriod(rows: AllExecRow[], period: string): AllExecRow[] {
  if (period === 'all') return rows;
  const ms = period === '24h' ? 86400_000
           : period === '7d'  ? 7 * 86400_000
           : 30 * 86400_000;
  return rows.filter(r => {
    if (!r.iniciada_em) return false;
    return Date.now() - new Date(r.iniciada_em).getTime() <= ms;
  });
}

export async function overviewRoutes(server: FastifyInstance): Promise<void> {
  const config = loadConfig();

  server.get('/overview', async (request, reply) => {
    const qResult = QuerySchema.safeParse(request.query);
    const period = qResult.success ? qResult.data.period : '7d';

    const openResult = openDb(config.dbPath, config.supportedSchemaVersions);
    if (!openResult.ok) {
      return reply.status(200).send(wrapDegraded(openResult.reason, config.dbPath));
    }

    const { db } = openResult;
    try {
      const kpis = getOverviewKPIs(db);
      const recentAlerts = getRecentAlerts(db);
      const activeExecutions = getActiveExecutions(db);
      const projectRollups = getRollupByProject(db);
      const featureRollups = getRollupByFeature(db);
      const modelMix = getModelMix(db);
      const recentActivity = getRecentActivity(db);
      const costSeries = getCostSeries(db);

      // Filtrar por periodo para leaderboard
      const allExecs = db
        .prepare(`
          SELECT project, feature, execucao_id, status, tool_calls_total,
                 ondas_total, decisoes_total, iniciada_em, terminada_em
          FROM executions
          ORDER BY tool_calls_total DESC NULLS LAST
        `)
        .all() as AllExecRow[];

      const filtered = period === 'all' ? allExecs : filterByPeriod(allExecs, period);

      // Funil de etapas
      const funnelRows = db
        .prepare(`
          SELECT etapa_corrente as etapa, count(*) as count
          FROM executions
          WHERE etapa_corrente IS NOT NULL
          GROUP BY etapa_corrente
          ORDER BY count DESC
        `)
        .all() as { etapa: string; count: number }[];

      const data = {
        kpis: {
          totalExecutions: kpis.total_executions,
          activeExecutions: kpis.active_executions,
          completedExecutions: kpis.completed_executions,
          abortedExecutions: kpis.aborted_executions,
          totalWaves: kpis.total_waves,
          totalDecisions: kpis.total_decisions,
          /** proxy de custo — rotular como "proxy: tool calls" na UI */
          toolCallsTotal: kpis.total_tool_calls,
          wallclockTotal: kpis.total_wallclock,
          testsPassed: kpis.tests_passed,
          testsTotal: kpis.tests_total,
          totalProjects: kpis.total_projects,
          totalFeatures: kpis.total_features,
        },
        recentAlerts: recentAlerts.map(a => ({
          execucaoId: a.execucao_id,
          tipo: a.tipo,
          subtipo: a.subtipo,
          descricao: a.descricao,
          wave: a.wave,
          valorConsumido: a.valor_consumido,
          valorThreshold: a.valor_threshold,
        })),
        inProgress: activeExecutions.map(e => ({
          execucaoId: e.execucao_id,
          project: e.project,
          feature: e.feature,
          status: e.status,
          etapaCorrente: e.etapa_corrente,
          iniciadaEm: e.iniciada_em,
          ondasTotal: e.ondas_total,
          toolCallsTotal: e.tool_calls_total,
          wallclockSegundos: e.wallclock_total_segundos,
        })),
        /** mix derivado de decisoes de roteamento logadas (FR-010: nao e o
         *  relatorio canonico; UI rotula como derivado). */
        modelMix: modelMix.map(m => ({ modelo: m.modelo, n: m.n })),
        recentActivity: recentActivity.map(a => ({
          execucaoId: a.execucao_id,
          project: a.project,
          feature: a.feature,
          wave: a.wave,
          eventType: a.event_type,
          timestamp: a.timestamp,
          descricao: a.descricao,
        })),
        costSeries,
        leaderboard: filtered.slice(0, 10).map(e => ({
          execucaoId: e.execucao_id,
          project: e.project,
          feature: e.feature,
          status: e.status,
          toolCallsTotal: e.tool_calls_total,
          ondasTotal: e.ondas_total,
          decisoesTotal: e.decisoes_total,
        })),
        funnel: funnelRows,
        projectRollups: projectRollups.map(r => ({
          project: r.project,
          totalExecutions: r.total_executions,
          activeExecutions: r.active_executions,
          completedExecutions: r.completed_executions,
          abortedExecutions: r.aborted_executions,
          totalDecisions: r.total_decisions,
          totalToolCalls: r.total_tool_calls,
          latestExecutionAt: r.latest_execution_at,
        })),
        featureRollups: featureRollups.slice(0, 20).map(r => ({
          project: r.project,
          feature: r.feature,
          totalExecutions: r.total_executions,
          latestStatus: r.latest_status,
          latestExecutionAt: r.latest_execution_at,
        })),
      };

      const envelope = wrap(data, {}, config.dbPath, db);

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
