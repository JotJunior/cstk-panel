/**
 * Queries de metricas agregadas — 8 endpoints de metricas.
 * Ref: contracts/api-read.md §Metricas agregadas; spec.md FR-008, FR-009
 * Task 3.3.6
 *
 * Principio III (Honestidade de Metrica):
 * - toolCallsTotal = proxy de custo; NUNCA rotular como "$" ou "tokens" na UI.
 * - clarify-resolution: meta.approximate=true (taxa derivada/estimada).
 * - mix de modelos: nao tem endpoint — card "indisponivel nesta fonte" na UI.
 *
 * Todos os filtros via binding parametrizado.
 *
 * FASE 2 (new-schema): todos os nomes pt-BR→EN snake_case (task 2.10).
 */
import type Database from 'better-sqlite3';
import { hasColumn } from '../columns.js';

export type MetricPeriod = '24h' | '7d' | '30d' | 'all';

function periodToFilter(period: MetricPeriod | undefined): string | null {
  switch (period) {
    case '24h': return "datetime('now', '-1 day')";
    case '7d':  return "datetime('now', '-7 days')";
    case '30d': return "datetime('now', '-30 days')";
    case 'all':
    default:    return null;
  }
}

// ─────────────────────────────────────────────────────────
// 1. cost-over-time — serie temporal por dia
// ─────────────────────────────────────────────────────────

export interface CostOverTimeRow {
  day: string;       // date(started_at) → 'YYYY-MM-DD'
  toolCalls: number; // proxy de custo — NUNCA rotular como "$" na UI
}

export function getCostOverTime(
  db: Database.Database,
  filters: { project?: string; period?: MetricPeriod } = {}
): CostOverTimeRow[] {
  const startedAtCol = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
  const conditions: string[] = ["tool_calls_total IS NOT NULL"];
  const params: unknown[] = [];

  if (filters.project !== undefined) {
    conditions.push('project = ?');
    params.push(filters.project);
  }

  const pf = periodToFilter(filters.period);
  if (pf) {
    conditions.push(`${startedAtCol} >= ${pf}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  return db
    .prepare(`
      SELECT date(${startedAtCol}) as day,
             sum(tool_calls_total) as toolCalls
      FROM executions
      ${where}
      GROUP BY date(${startedAtCol})
      ORDER BY day ASC
    `)
    .all(...params) as CostOverTimeRow[];
}

// ─────────────────────────────────────────────────────────
// 2. throughput-by-stage — decisoes por stage
// ─────────────────────────────────────────────────────────

export interface ThroughputByStageRow {
  stage: string;
  count: number;
}

export function getThroughputByStage(db: Database.Database): ThroughputByStageRow[] {
  const stageCol = hasColumn(db, 'decisions', 'stage') ? 'stage' : 'NULL';
  return db
    .prepare(`
      SELECT ${stageCol} as stage, count(*) as count
      FROM decisions
      WHERE ${stageCol} IS NOT NULL
      GROUP BY ${stageCol}
      ORDER BY count DESC
    `)
    .all() as ThroughputByStageRow[];
}

// ─────────────────────────────────────────────────────────
// 3. test-pass-rate — taxa de testes passando nas tasks
// ─────────────────────────────────────────────────────────

export interface TestPassRateResult {
  pass: number;
  fail: number;
  rate: number;  // 0..1
}

export function getTestPassRate(db: Database.Database): TestPassRateResult {
  const row = db
    .prepare(`
      SELECT
        sum(CASE WHEN outcome = 'pass' THEN 1 ELSE 0 END) as pass,
        sum(CASE WHEN outcome = 'fail' THEN 1 ELSE 0 END) as fail
      FROM tasks
      WHERE outcome IS NOT NULL
    `)
    .get() as { pass: number | null; fail: number | null };

  const pass = row.pass ?? 0;
  const fail = row.fail ?? 0;
  const total = pass + fail;
  const rate = total > 0 ? pass / total : 0;

  return { pass, fail, rate };
}

// ─────────────────────────────────────────────────────────
// 3b. test-pass-rate-series — taxa de testes passando por DIA
//     (tasks nao tem timestamp; agrupa por date(executions.started_at))
// ─────────────────────────────────────────────────────────

export interface TestPassRateSeriesRow {
  day: string;   // 'YYYY-MM-DD'
  pass: number;
  fail: number;
  rate: number;  // 0..1
}

export function getTestPassRateSeries(
  db: Database.Database,
  filters: { period?: MetricPeriod } = {}
): TestPassRateSeriesRow[] {
  const startedAtCol = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
  const execIdCol = hasColumn(db, 'executions', 'execution_id') ? 'execution_id' : 'rowid';
  const taskExecIdCol = hasColumn(db, 'tasks', 'execution_id') ? 'execution_id' : 'rowid';
  const conditions: string[] = ['t.outcome IS NOT NULL'];
  const pf = periodToFilter(filters.period);
  if (pf) conditions.push(`e.${startedAtCol} >= ${pf}`);
  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = db
    .prepare(`
      SELECT date(e.${startedAtCol}) as day,
             sum(CASE WHEN t.outcome = 'pass' THEN 1 ELSE 0 END) as pass,
             sum(CASE WHEN t.outcome = 'fail' THEN 1 ELSE 0 END) as fail
      FROM tasks t
      JOIN executions e ON e.${execIdCol} = t.${taskExecIdCol}
      ${where}
      GROUP BY day
      ORDER BY day ASC
    `)
    .all() as { day: string | null; pass: number | null; fail: number | null }[];

  return rows
    .filter(r => r.day != null)
    .map(r => {
      const pass = r.pass ?? 0;
      const fail = r.fail ?? 0;
      const total = pass + fail;
      return { day: r.day as string, pass, fail, rate: total > 0 ? pass / total : 0 };
    });
}

// ─────────────────────────────────────────────────────────
// 4. human-latency — latencia de resolucao de bloqueios humanos
// ─────────────────────────────────────────────────────────

export interface HumanLatencyRow {
  executionId: string;
  latencySeconds: number | null;
}

export function getHumanLatency(db: Database.Database): HumanLatencyRow[] {
  const execIdCol = hasColumn(db, 'executions', 'execution_id') ? 'execution_id' : 'rowid';
  const blocksCol = hasColumn(db, 'executions', 'human_blocks_total') ? 'human_blocks_total' : '0';
  const durCol = hasColumn(db, 'executions', 'duration_seconds') ? 'duration_seconds' : 'NULL';
  // Estimar latencia como duration_seconds / human_blocks_total
  // (aproximacao — dados reais de timestamps de bloqueio nao estao no schema v2)
  return db
    .prepare(`
      SELECT ${execIdCol} as executionId,
             CASE
               WHEN ${blocksCol} > 0 AND ${durCol} IS NOT NULL
               THEN round(${durCol} / ${blocksCol}, 2)
               ELSE NULL
             END as latencySeconds
      FROM executions
      WHERE ${blocksCol} > 0
      ORDER BY latencySeconds DESC
      LIMIT 50
    `)
    .all() as HumanLatencyRow[];
}

// ─────────────────────────────────────────────────────────
// 5. clarify-resolution — taxa de perguntas respondidas autonomamente
//    meta.approximate = TRUE (Principio III — taxa derivada/estimada)
// ─────────────────────────────────────────────────────────

export interface ClarifyResolutionResult {
  totalClarifyDecisions: number;
  autonomouslyResolved: number; // score >= 2 (sem pausa humana)
  humanPaused: number;          // score = 0 (pause_humano)
  rate: number;                 // 0..1 — APPROXIMATE
}

/**
 * ATENCAO: este resultado e APPROXIMATE (Principio III).
 * A taxa e derivada contando decisoes score>=2 em stage=clarify.
 * Isso e uma estimativa — nao ha dado exato de "clarify resolvido autonomamente".
 * O caller DEVE retornar meta.approximate=true.
 */
export function getClarifyResolution(db: Database.Database): ClarifyResolutionResult {
  const stageCol = hasColumn(db, 'decisions', 'stage') ? 'stage' : 'NULL';
  const row = db
    .prepare(`
      SELECT
        count(*) as total,
        sum(CASE WHEN score >= 2 THEN 1 ELSE 0 END) as autonomous,
        sum(CASE WHEN score = 0 THEN 1 ELSE 0 END) as human_paused
      FROM decisions
      WHERE ${stageCol} = 'clarify'
    `)
    .get() as { total: number | null; autonomous: number | null; human_paused: number | null };

  const total = row.total ?? 0;
  const autonomous = row.autonomous ?? 0;
  const humanPaused = row.human_paused ?? 0;
  const rate = total > 0 ? autonomous / total : 0;

  return {
    totalClarifyDecisions: total,
    autonomouslyResolved: autonomous,
    humanPaused: humanPaused,
    rate,
  };
}

// ─────────────────────────────────────────────────────────
// 6. decisions-by-score — distribuicao de scores
// ─────────────────────────────────────────────────────────

export interface DecisionsByScoreRow {
  score: number | null;
  count: number;
}

export function getDecisionsByScore(db: Database.Database): DecisionsByScoreRow[] {
  return db
    .prepare(`
      SELECT score, count(*) as count
      FROM decisions
      GROUP BY score
      ORDER BY score ASC
    `)
    .all() as DecisionsByScoreRow[];
}

// ─────────────────────────────────────────────────────────
// 7. execution-duration — duracao por execucao
// ─────────────────────────────────────────────────────────

export interface ExecutionDurationRow {
  executionId: string;
  project: string;
  feature: string;
  durationSeconds: number | null;
  waves: number | null;
}

export function getExecutionDuration(
  db: Database.Database,
  filters: { project?: string; period?: MetricPeriod } = {}
): ExecutionDurationRow[] {
  const execIdCol = hasColumn(db, 'executions', 'execution_id') ? 'execution_id' : 'rowid';
  const durCol = hasColumn(db, 'executions', 'duration_seconds') ? 'duration_seconds' : 'NULL';
  const wavesCol = hasColumn(db, 'executions', 'waves_total') ? 'waves_total' : 'NULL';
  const startedAtCol = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
  const conditions: string[] = [`${durCol} IS NOT NULL`];
  const params: unknown[] = [];

  if (filters.project !== undefined) {
    conditions.push('project = ?');
    params.push(filters.project);
  }

  const pf = periodToFilter(filters.period);
  if (pf) {
    conditions.push(`${startedAtCol} >= ${pf}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  return db
    .prepare(`
      SELECT ${execIdCol} as executionId, project, feature,
             ${durCol} as durationSeconds, ${wavesCol} as waves
      FROM executions
      ${where}
      ORDER BY ${durCol} DESC
      LIMIT 100
    `)
    .all(...params) as ExecutionDurationRow[];
}

// ─────────────────────────────────────────────────────────
// 8. depth-subagents — profundidade e subagentes por execucao
// ─────────────────────────────────────────────────────────

export interface DepthSubagentsRow {
  executionId: string;
  project: string;
  feature: string;
  maxDepth: number | null;
  subagentsSpawned: number | null;
}

export function getDepthSubagents(db: Database.Database): DepthSubagentsRow[] {
  const execIdCol = hasColumn(db, 'executions', 'execution_id') ? 'execution_id' : 'rowid';
  const maxDepthCol = hasColumn(db, 'executions', 'max_depth') ? 'max_depth' : 'NULL';
  const subagentsCol = hasColumn(db, 'executions', 'subagents_spawned') ? 'subagents_spawned' : 'NULL';
  return db
    .prepare(`
      SELECT ${execIdCol} as executionId, project, feature,
             ${maxDepthCol} as maxDepth,
             ${subagentsCol} as subagentsSpawned
      FROM executions
      WHERE ${maxDepthCol} IS NOT NULL
         OR ${subagentsCol} IS NOT NULL
      ORDER BY ${maxDepthCol} DESC NULLS LAST
      LIMIT 100
    `)
    .all() as DepthSubagentsRow[];
}

// ─────────────────────────────────────────────────────────
// 9. model-mix — DERIVADO das decisoes de roteamento (choice='model:%')
//    Intenção do roteador, NAO confirmação da harness. Dono canônico
//    do relatorio: model-routing-report.sh (FR-010 — UI rotula como derivado).
// ─────────────────────────────────────────────────────────

export interface ModelMixRow { modelo: string; n: number; }
export interface ModelMixByStageRow { stage: string; modelo: string; n: number; }

/** Mix total de modelos (donut). */
export function getModelMix(db: Database.Database): ModelMixRow[] {
  const choiceCol = hasColumn(db, 'decisions', 'choice') ? 'choice' : 'NULL';
  return db
    .prepare(`
      SELECT replace(${choiceCol}, 'model:', '') as modelo, count(*) as n
      FROM decisions
      WHERE ${choiceCol} LIKE 'model:%'
      GROUP BY modelo
      ORDER BY n DESC
    `)
    .all() as ModelMixRow[];
}

/** Mix de modelos por stage SDD (barras empilhadas). */
export function getModelMixByStage(db: Database.Database): ModelMixByStageRow[] {
  const choiceCol = hasColumn(db, 'decisions', 'choice') ? 'choice' : 'NULL';
  const stageCol = hasColumn(db, 'decisions', 'stage') ? 'stage' : 'NULL';
  return db
    .prepare(`
      SELECT ${stageCol} as stage, replace(${choiceCol}, 'model:', '') as modelo, count(*) as n
      FROM decisions
      WHERE ${choiceCol} LIKE 'model:%' AND ${stageCol} IS NOT NULL
      GROUP BY ${stageCol}, modelo
      ORDER BY ${stageCol} ASC
    `)
    .all() as ModelMixByStageRow[];
}

// ─────────────────────────────────────────────────────────
// 10. recall-consultations — consultas ao histórico (read-back loop, schema v3)
//     Evento `recall_consulted` gravado a cada `cstk recall --context` no
//     início de specify/plan, INCLUSIVE com hits=0. A `description` carrega
//     `etapa=… hits=N`. Contagem EXATA (Princípio III — não proxy/aproximada).
//     produtivas = hits>0; vazias = total - produtivas (inclui description sem
//     `hits=` parseável, que degrada para vazia sem quebrar — FR-V3-007).
// ─────────────────────────────────────────────────────────

export interface RecallConsultationsResult {
  total: number;
  produtivas: number; // hits > 0
  vazias: number;     // hits = 0 ou description sem hits parseável
}

const HITS_RE = /hits=(\d+)/;

export function getRecallConsultations(db: Database.Database): RecallConsultationsResult {
  const descCol = hasColumn(db, 'events', 'description') ? 'description' : 'NULL';
  const rows = db
    .prepare(`
      SELECT ${descCol} as description
      FROM events
      WHERE event_type = 'recall_consulted'
    `)
    .all() as { description: string | null }[];

  const total = rows.length;
  let produtivas = 0;
  for (const r of rows) {
    const m = r.description ? HITS_RE.exec(r.description) : null;
    if (m && Number(m[1]) > 0) produtivas++;
  }
  return { total, produtivas, vazias: total - produtivas };
}
