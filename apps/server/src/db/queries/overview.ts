/**
 * Query de visao geral (KPIs, alertas recentes, execucoes em andamento).
 * Ref: contracts/api-read.md §Saude e visao geral; spec.md FR-005
 * Task 3.3.7
 *
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
  total_projects: number;
  total_features: number;
}

export interface RecentAlertRow {
  execucao_id: string;
  tipo: string;
  subtipo: string | null;
  descricao: string | null;
  wave: string;
}

export interface ActiveExecutionRow {
  execucao_id: string;
  project: string;
  feature: string;
  status: string;
  etapa_corrente: string | null;
  iniciada_em: string | null;
  ondas_total: number | null;
}

/** KPIs de alto nivel */
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
      count(DISTINCT project) as total_projects,
      count(DISTINCT feature) as total_features
    FROM executions
  `).get() as OverviewKPIs;
  return row;
}

/** Alertas mais recentes (limite 10) */
export function getRecentAlerts(
  db: Database.Database,
  limit = 10
): RecentAlertRow[] {
  return db.prepare(`
    SELECT execucao_id, tipo, subtipo, descricao, wave
    FROM alert_signals
    ORDER BY rowid DESC
    LIMIT ?
  `).all(limit) as RecentAlertRow[];
}

/** Execucoes ativas (em_andamento ou aguardando_humano) */
export function getActiveExecutions(db: Database.Database): ActiveExecutionRow[] {
  return db.prepare(`
    SELECT execucao_id, project, feature, status, etapa_corrente,
           iniciada_em, ondas_total
    FROM executions
    WHERE status IN ('em_andamento', 'aguardando_humano')
    ORDER BY iniciada_em DESC
  `).all() as ActiveExecutionRow[];
}
