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
 */
import type Database from 'better-sqlite3';

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
  day: string;       // date(iniciada_em) → 'YYYY-MM-DD'
  toolCalls: number; // proxy de custo — NUNCA rotular como "$" na UI
}

export function getCostOverTime(
  db: Database.Database,
  filters: { project?: string; period?: MetricPeriod } = {}
): CostOverTimeRow[] {
  const conditions: string[] = ["tool_calls_total IS NOT NULL"];
  const params: unknown[] = [];

  if (filters.project !== undefined) {
    conditions.push('project = ?');
    params.push(filters.project);
  }

  const pf = periodToFilter(filters.period);
  if (pf) {
    conditions.push(`iniciada_em >= ${pf}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  return db
    .prepare(`
      SELECT date(iniciada_em) as day,
             sum(tool_calls_total) as toolCalls
      FROM executions
      ${where}
      GROUP BY date(iniciada_em)
      ORDER BY day ASC
    `)
    .all(...params) as CostOverTimeRow[];
}

// ─────────────────────────────────────────────────────────
// 2. throughput-by-stage — decisoes por etapa
// ─────────────────────────────────────────────────────────

export interface ThroughputByStageRow {
  etapa: string;
  count: number;
}

export function getThroughputByStage(db: Database.Database): ThroughputByStageRow[] {
  return db
    .prepare(`
      SELECT etapa, count(*) as count
      FROM decisions
      WHERE etapa IS NOT NULL
      GROUP BY etapa
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
//     (tasks nao tem timestamp; agrupa por date(executions.iniciada_em))
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
  const conditions: string[] = ['t.outcome IS NOT NULL'];
  const pf = periodToFilter(filters.period);
  if (pf) conditions.push(`e.iniciada_em >= ${pf}`);
  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = db
    .prepare(`
      SELECT date(e.iniciada_em) as day,
             sum(CASE WHEN t.outcome = 'pass' THEN 1 ELSE 0 END) as pass,
             sum(CASE WHEN t.outcome = 'fail' THEN 1 ELSE 0 END) as fail
      FROM tasks t
      JOIN executions e ON e.execucao_id = t.execucao_id
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
  execucaoId: string;
  latenciaSegundos: number | null;
}

export function getHumanLatency(db: Database.Database): HumanLatencyRow[] {
  // Estimar latencia como duracao_segundos / bloqueios_humanos_total
  // (aproximacao — dados reais de timestamps de bloqueio nao estao no schema v2)
  return db
    .prepare(`
      SELECT execucao_id as execucaoId,
             CASE
               WHEN bloqueios_humanos_total > 0 AND duracao_segundos IS NOT NULL
               THEN round(duracao_segundos / bloqueios_humanos_total, 2)
               ELSE NULL
             END as latenciaSegundos
      FROM executions
      WHERE bloqueios_humanos_total > 0
      ORDER BY latenciaSegundos DESC
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
 * A taxa e derivada contando decisoes score>=2 em etapa=clarify.
 * Isso e uma estimativa — nao ha dado exato de "clarify resolvido autonomamente".
 * O caller DEVE retornar meta.approximate=true.
 */
export function getClarifyResolution(db: Database.Database): ClarifyResolutionResult {
  const row = db
    .prepare(`
      SELECT
        count(*) as total,
        sum(CASE WHEN score >= 2 THEN 1 ELSE 0 END) as autonomous,
        sum(CASE WHEN score = 0 THEN 1 ELSE 0 END) as human_paused
      FROM decisions
      WHERE etapa = 'clarify'
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
  execucaoId: string;
  project: string;
  feature: string;
  duracaoSegundos: number | null;
  ondas: number | null;
}

export function getExecutionDuration(
  db: Database.Database,
  filters: { project?: string; period?: MetricPeriod } = {}
): ExecutionDurationRow[] {
  const conditions: string[] = ['duracao_segundos IS NOT NULL'];
  const params: unknown[] = [];

  if (filters.project !== undefined) {
    conditions.push('project = ?');
    params.push(filters.project);
  }

  const pf = periodToFilter(filters.period);
  if (pf) {
    conditions.push(`iniciada_em >= ${pf}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  return db
    .prepare(`
      SELECT execucao_id as execucaoId, project, feature,
             duracao_segundos as duracaoSegundos, ondas_total as ondas
      FROM executions
      ${where}
      ORDER BY duracao_segundos DESC
      LIMIT 100
    `)
    .all(...params) as ExecutionDurationRow[];
}

// ─────────────────────────────────────────────────────────
// 8. depth-subagents — profundidade e subagentes por execucao
// ─────────────────────────────────────────────────────────

export interface DepthSubagentsRow {
  execucaoId: string;
  project: string;
  feature: string;
  profundidadeMax: number | null;
  subagentesSpawned: number | null;
}

export function getDepthSubagents(db: Database.Database): DepthSubagentsRow[] {
  return db
    .prepare(`
      SELECT execucao_id as execucaoId, project, feature,
             profundidade_max as profundidadeMax,
             subagentes_spawned as subagentesSpawned
      FROM executions
      WHERE profundidade_max IS NOT NULL
         OR subagentes_spawned IS NOT NULL
      ORDER BY profundidade_max DESC NULLS LAST
      LIMIT 100
    `)
    .all() as DepthSubagentsRow[];
}

// ─────────────────────────────────────────────────────────
// 9. model-mix — DERIVADO das decisoes de roteamento (escolha='model:%')
//    Intenção do roteador, NAO confirmação da harness. Dono canônico
//    do relatorio: model-routing-report.sh (FR-010 — UI rotula como derivado).
// ─────────────────────────────────────────────────────────

export interface ModelMixRow { modelo: string; n: number; }
export interface ModelMixByStageRow { etapa: string; modelo: string; n: number; }

/** Mix total de modelos (donut). */
export function getModelMix(db: Database.Database): ModelMixRow[] {
  return db
    .prepare(`
      SELECT replace(escolha, 'model:', '') as modelo, count(*) as n
      FROM decisions
      WHERE escolha LIKE 'model:%'
      GROUP BY modelo
      ORDER BY n DESC
    `)
    .all() as ModelMixRow[];
}

/** Mix de modelos por etapa SDD (barras empilhadas). */
export function getModelMixByStage(db: Database.Database): ModelMixByStageRow[] {
  return db
    .prepare(`
      SELECT etapa, replace(escolha, 'model:', '') as modelo, count(*) as n
      FROM decisions
      WHERE escolha LIKE 'model:%' AND etapa IS NOT NULL
      GROUP BY etapa, modelo
      ORDER BY etapa ASC
    `)
    .all() as ModelMixByStageRow[];
}

// ─────────────────────────────────────────────────────────
// 10. recall-consultations — consultas ao histórico (read-back loop, schema v3)
//     Evento `recall_consulted` gravado a cada `cstk recall --context` no
//     início de specify/plan, INCLUSIVE com hits=0. A `descricao` carrega
//     `etapa=… hits=N`. Contagem EXATA (Princípio III — não proxy/aproximada).
//     produtivas = hits>0; vazias = total - produtivas (inclui descricao sem
//     `hits=` parseável, que degrada para vazia sem quebrar — FR-V3-007).
// ─────────────────────────────────────────────────────────

export interface RecallConsultationsResult {
  total: number;
  produtivas: number; // hits > 0
  vazias: number;     // hits = 0 ou descricao sem hits parseável
}

const HITS_RE = /hits=(\d+)/;

export function getRecallConsultations(db: Database.Database): RecallConsultationsResult {
  const rows = db
    .prepare(`
      SELECT descricao
      FROM events
      WHERE event_type = 'recall_consulted'
    `)
    .all() as { descricao: string | null }[];

  const total = rows.length;
  let produtivas = 0;
  for (const r of rows) {
    const m = r.descricao ? HITS_RE.exec(r.descricao) : null;
    if (m && Number(m[1]) > 0) produtivas++;
  }
  return { total, produtivas, vazias: total - produtivas };
}
