/**
 * Query de visao geral (KPIs, alertas recentes, execucoes em andamento,
 * mix de modelos, atividade e serie de custo).
 * Ref: contracts/api-read.md §Saude e visao geral; spec.md FR-005, FR-008
 *
 * Principio I (Read-Only): apenas SELECT com prepared statements.
 * Principio III (Honestidade de Metrica): toolCallsTotal e proxy de custo —
 * NUNCA rotular como "$" ou "tokens" na UI.
 *
 * FASE 2 (new-schema): todos os nomes pt-BR→EN snake_case (task 2.10).
 */
import type Database from 'better-sqlite3';
import { hasColumn } from '../columns.js';

export interface OverviewKPIs {
  total_executions: number;
  active_executions: number;
  completed_executions: number;
  aborted_executions: number;
  total_waves: number;
  total_decisions: number;
  total_tool_calls: number | null;  // proxy — rotular como "tool calls" na UI
  total_wallclock: number | null;   // segundos acumulados (tempo de parede)
  tests_passed: number | null;
  tests_total: number | null;
  total_projects: number;
  total_features: number;
}

export interface RecentAlertRow {
  execution_id: string;
  type: string;
  subtype: string | null;
  description: string | null;
  wave: string;
  consumed_value: number | null;
  threshold_value: number | null;
}

export interface ActiveExecutionRow {
  execution_id: string;
  project: string;
  feature: string;
  status: string;
  current_stage: string | null;
  started_at: string | null;
  waves_total: number | null;
  tool_calls_total: number | null;
  wallclock_total_seconds: number | null;
}

export interface ModelMixRow {
  modelo: string;
  n: number;
}

export interface ActivityRow {
  execution_id: string;
  project: string;
  feature: string;
  wave: string;
  event_type: string;
  timestamp: string;
  description: string | null;
}

/** KPIs de alto nivel. Test pass e tempo de parede via subconsultas. */
export function getOverviewKPIs(db: Database.Database): OverviewKPIs {
  const decCol = hasColumn(db, 'executions', 'decisions_total') ? 'decisions_total' : '0';
  const wallCol = hasColumn(db, 'executions', 'wallclock_total_seconds') ? 'wallclock_total_seconds' : '0';
  const testsPassedCol = hasColumn(db, 'tasks', 'tests_passed') ? 'tests_passed' : '0';
  const testsRunCol = hasColumn(db, 'tasks', 'tests_run') ? 'tests_run' : '0';
  const row = db.prepare(`
    SELECT
      count(*) as total_executions,
      sum(CASE WHEN status IN ('em_andamento','aguardando_humano') THEN 1 ELSE 0 END) as active_executions,
      sum(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_executions,
      sum(CASE WHEN status = 'abortada' THEN 1 ELSE 0 END) as aborted_executions,
      (SELECT count(*) FROM waves) as total_waves,
      sum(coalesce(${decCol}, 0)) as total_decisions,
      sum(tool_calls_total) as total_tool_calls,
      sum(${wallCol}) as total_wallclock,
      (SELECT sum(${testsPassedCol}) FROM tasks) as tests_passed,
      (SELECT sum(${testsRunCol}) FROM tasks) as tests_total,
      count(DISTINCT project) as total_projects,
      count(DISTINCT feature) as total_features
    FROM executions
  `).get() as OverviewKPIs;
  return row;
}

/** Alertas mais recentes (limite 10), com consumido/threshold. */
export function getRecentAlerts(db: Database.Database, limit = 10): RecentAlertRow[] {
  const execIdCol = hasColumn(db, 'alert_signals', 'execution_id') ? 'execution_id' : 'NULL as execution_id';
  const typeCol = hasColumn(db, 'alert_signals', 'type') ? 'type' : "'' as type";
  const subtypeCol = hasColumn(db, 'alert_signals', 'subtype') ? 'subtype' : 'NULL as subtype';
  const descCol = hasColumn(db, 'alert_signals', 'description') ? 'description' : 'NULL as description';
  const consumedCol = hasColumn(db, 'alert_signals', 'consumed_value') ? 'consumed_value' : 'NULL as consumed_value';
  const thresholdCol = hasColumn(db, 'alert_signals', 'threshold_value') ? 'threshold_value' : 'NULL as threshold_value';
  return db.prepare(`
    SELECT ${execIdCol}, ${typeCol}, ${subtypeCol}, ${descCol}, wave,
           ${consumedCol}, ${thresholdCol}
    FROM alert_signals
    ORDER BY rowid DESC
    LIMIT ?
  `).all(limit) as RecentAlertRow[];
}

/** Execucoes ativas (em_andamento ou aguardando_humano), com proxy de custo. */
export function getActiveExecutions(db: Database.Database): ActiveExecutionRow[] {
  const execIdCol = hasColumn(db, 'executions', 'execution_id') ? 'execution_id' : 'NULL as execution_id';
  const stageCol = hasColumn(db, 'executions', 'current_stage') ? 'current_stage' : 'NULL as current_stage';
  const startedCol = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'NULL as started_at';
  const wavesCol = hasColumn(db, 'executions', 'waves_total') ? 'waves_total' : 'NULL as waves_total';
  const wallCol = hasColumn(db, 'executions', 'wallclock_total_seconds') ? 'wallclock_total_seconds' : 'NULL as wallclock_total_seconds';
  const orderCol = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
  return db.prepare(`
    SELECT ${execIdCol}, project, feature, status, ${stageCol},
           ${startedCol}, ${wavesCol}, tool_calls_total, ${wallCol}
    FROM executions
    WHERE status IN ('em_andamento', 'aguardando_humano')
    ORDER BY ${orderCol} DESC
  `).all() as ActiveExecutionRow[];
}

/**
 * Mix de modelos derivado das decisoes de roteamento logadas
 * (choice = 'model:<modelo>'). NAO e o relatorio canonico
 * (model-routing-report.sh) — a UI rotula como derivado (FR-010).
 */
export function getModelMix(db: Database.Database): ModelMixRow[] {
  const choiceCol = hasColumn(db, 'decisions', 'choice') ? 'choice' : 'NULL';
  return db.prepare(`
    SELECT replace(${choiceCol}, 'model:', '') as modelo, count(*) as n
    FROM decisions
    WHERE ${choiceCol} LIKE 'model:%'
    GROUP BY modelo
    ORDER BY n DESC
  `).all() as ModelMixRow[];
}

/** Atividade recente a partir da timeline de eventos. */
export function getRecentActivity(db: Database.Database, limit = 8): ActivityRow[] {
  const execIdCol = hasColumn(db, 'events', 'execution_id') ? 'execution_id' : 'NULL as execution_id';
  const descCol = hasColumn(db, 'events', 'description') ? 'description' : 'NULL as description';
  return db.prepare(`
    SELECT ${execIdCol}, project, feature, wave, event_type, timestamp, ${descCol}
    FROM events
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as ActivityRow[];
}

/** Serie de custo (tool_calls por dia) a partir das ondas — para sparkline. */
export function getCostSeries(db: Database.Database, days = 14): number[] {
  const startedCol = hasColumn(db, 'waves', 'started_at') ? 'started_at' : 'source_ts';
  const rows = db.prepare(`
    SELECT substr(coalesce(${startedCol}, source_ts), 1, 10) as day,
           sum(coalesce(tool_calls, 0)) as total
    FROM waves
    GROUP BY day
    ORDER BY day DESC
    LIMIT ?
  `).all(days) as { day: string; total: number }[];
  // Ordem cronologica ascendente para o sparkline.
  return rows.reverse().map(r => r.total);
}
