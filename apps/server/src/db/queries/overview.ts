/**
 * Query de visao geral (KPIs, alertas recentes, execucoes em andamento,
 * mix de modelos, atividade e serie de custo).
 * Ref: contracts/api-read.md §Saude e visao geral; spec.md FR-005, FR-008
 *
 * Principio I (Read-Only): apenas SELECT com prepared statements.
 * Principio III (Honestidade de Metrica): toolCallsTotal e proxy de custo —
 * NUNCA rotular como "$" ou "tokens" na UI.
 */
import type Database from 'better-sqlite3';

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
  execucao_id: string;
  tipo: string;
  subtipo: string | null;
  descricao: string | null;
  wave: string;
  valor_consumido: number | null;
  valor_threshold: number | null;
}

export interface ActiveExecutionRow {
  execucao_id: string;
  project: string;
  feature: string;
  status: string;
  etapa_corrente: string | null;
  iniciada_em: string | null;
  ondas_total: number | null;
  tool_calls_total: number | null;
  wallclock_total_segundos: number | null;
}

export interface ModelMixRow {
  modelo: string;
  n: number;
}

export interface ActivityRow {
  execucao_id: string;
  project: string;
  feature: string;
  wave: string;
  event_type: string;
  timestamp: string;
  descricao: string | null;
}

/** KPIs de alto nivel. Test pass e tempo de parede via subconsultas. */
export function getOverviewKPIs(db: Database.Database): OverviewKPIs {
  const row = db.prepare(`
    SELECT
      count(*) as total_executions,
      sum(CASE WHEN status IN ('em_andamento','aguardando_humano') THEN 1 ELSE 0 END) as active_executions,
      sum(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_executions,
      sum(CASE WHEN status = 'abortada' THEN 1 ELSE 0 END) as aborted_executions,
      (SELECT count(*) FROM waves) as total_waves,
      sum(coalesce(decisoes_total, 0)) as total_decisions,
      sum(tool_calls_total) as total_tool_calls,
      sum(wallclock_total_segundos) as total_wallclock,
      (SELECT sum(testes_passados) FROM tasks) as tests_passed,
      (SELECT sum(testes_rodados) FROM tasks) as tests_total,
      count(DISTINCT project) as total_projects,
      count(DISTINCT feature) as total_features
    FROM executions
  `).get() as OverviewKPIs;
  return row;
}

/** Alertas mais recentes (limite 10), com consumido/threshold. */
export function getRecentAlerts(db: Database.Database, limit = 10): RecentAlertRow[] {
  return db.prepare(`
    SELECT execucao_id, tipo, subtipo, descricao, wave,
           valor_consumido, valor_threshold
    FROM alert_signals
    ORDER BY rowid DESC
    LIMIT ?
  `).all(limit) as RecentAlertRow[];
}

/** Execucoes ativas (em_andamento ou aguardando_humano), com proxy de custo. */
export function getActiveExecutions(db: Database.Database): ActiveExecutionRow[] {
  return db.prepare(`
    SELECT execucao_id, project, feature, status, etapa_corrente,
           iniciada_em, ondas_total, tool_calls_total, wallclock_total_segundos
    FROM executions
    WHERE status IN ('em_andamento', 'aguardando_humano')
    ORDER BY iniciada_em DESC
  `).all() as ActiveExecutionRow[];
}

/**
 * Mix de modelos derivado das decisoes de roteamento logadas
 * (escolha = 'model:<modelo>'). NAO e o relatorio canonico
 * (model-routing-report.sh) — a UI rotula como derivado (FR-010).
 */
export function getModelMix(db: Database.Database): ModelMixRow[] {
  return db.prepare(`
    SELECT replace(escolha, 'model:', '') as modelo, count(*) as n
    FROM decisions
    WHERE escolha LIKE 'model:%'
    GROUP BY modelo
    ORDER BY n DESC
  `).all() as ModelMixRow[];
}

/** Atividade recente a partir da timeline de eventos. */
export function getRecentActivity(db: Database.Database, limit = 8): ActivityRow[] {
  return db.prepare(`
    SELECT execucao_id, project, feature, wave, event_type, timestamp, descricao
    FROM events
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as ActivityRow[];
}

/** Serie de custo (tool_calls por dia) a partir das ondas — para sparkline. */
export function getCostSeries(db: Database.Database, days = 14): number[] {
  const rows = db.prepare(`
    SELECT substr(coalesce(inicio, source_ts), 1, 10) as day,
           sum(coalesce(tool_calls, 0)) as total
    FROM waves
    GROUP BY day
    ORDER BY day DESC
    LIMIT ?
  `).all(days) as { day: string; total: number }[];
  // Ordem cronologica ascendente para o sparkline.
  return rows.reverse().map(r => r.total);
}
