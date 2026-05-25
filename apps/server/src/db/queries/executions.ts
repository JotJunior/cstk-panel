/**
 * Queries read-only para entidade executions.
 * Ref: data-model.md §Entities; contracts/api-read.md; spec.md FR-001, FR-003
 * Task 3.3.1
 *
 * Principio I (Read-Only Absoluto): apenas SELECT com prepared statements.
 * Parametros sempre via binding — nunca interpolacao de string.
 */
import type Database from 'better-sqlite3';

export interface ExecutionRow {
  project: string;
  feature: string;
  execucao_id: string;
  status: string | null;
  motivo_termino: string | null;
  etapa_corrente: string | null;
  iniciada_em: string | null;
  terminada_em: string | null;
  duracao_segundos: number | null;
  stack_sugerida: string | null;
  ondas_total: number | null;
  tool_calls_total: number | null;
  wallclock_total_segundos: number | null;
  subagentes_spawned: number | null;
  profundidade_max: number | null;
  decisoes_total: number | null;
  bloqueios_humanos_total: number | null;
  sugestoes_skills_total: number | null;
  issues_toolkit_abertas: number | null;
}

export interface ExecutionRollupRow {
  project: string;
  total_executions: number;
  active_executions: number;
  completed_executions: number;
  aborted_executions: number;
  total_decisions: number;
  total_tool_calls: number | null;
  total_wallclock: number | null;
  open_alerts: number;
  latest_execution_at: string | null;
}

export interface FeatureRollupRow {
  project: string;
  feature: string;
  total_executions: number;
  active_executions: number;
  completed_executions: number;
  aborted_executions: number;
  total_tool_calls: number | null;
  total_wallclock: number | null;
  total_decisions: number;
  total_ondas: number | null;
  total_bloqueios: number;
  etapa_corrente: string | null;
  open_alerts: number;
  latest_status: string | null;
  latest_execution_at: string | null;
}

/** Lista todas as execucoes, mais recentes primeiro */
export function listExecutions(db: Database.Database): ExecutionRow[] {
  return db
    .prepare(`
      SELECT project, feature, execucao_id, status, motivo_termino,
             etapa_corrente, iniciada_em, terminada_em, duracao_segundos,
             stack_sugerida, ondas_total, tool_calls_total,
             wallclock_total_segundos, subagentes_spawned, profundidade_max,
             decisoes_total, bloqueios_humanos_total, sugestoes_skills_total,
             issues_toolkit_abertas
      FROM executions
      ORDER BY iniciada_em DESC
    `)
    .all() as ExecutionRow[];
}

/** Busca execucao por ID */
export function getExecution(
  db: Database.Database,
  execucaoId: string
): ExecutionRow | undefined {
  return db
    .prepare(`
      SELECT project, feature, execucao_id, status, motivo_termino,
             etapa_corrente, iniciada_em, terminada_em, duracao_segundos,
             stack_sugerida, ondas_total, tool_calls_total,
             wallclock_total_segundos, subagentes_spawned, profundidade_max,
             decisoes_total, bloqueios_humanos_total, sugestoes_skills_total,
             issues_toolkit_abertas
      FROM executions
      WHERE execucao_id = ?
    `)
    .get(execucaoId) as ExecutionRow | undefined;
}

/** Lista execucoes por projeto */
export function listExecutionsByProject(
  db: Database.Database,
  project: string
): ExecutionRow[] {
  return db
    .prepare(`
      SELECT project, feature, execucao_id, status, motivo_termino,
             etapa_corrente, iniciada_em, terminada_em, duracao_segundos,
             stack_sugerida, ondas_total, tool_calls_total,
             wallclock_total_segundos, subagentes_spawned, profundidade_max,
             decisoes_total, bloqueios_humanos_total, sugestoes_skills_total,
             issues_toolkit_abertas
      FROM executions
      WHERE project = ?
      ORDER BY iniciada_em DESC
    `)
    .all(project) as ExecutionRow[];
}

/** Rollup por projeto */
export function getRollupByProject(db: Database.Database): ExecutionRollupRow[] {
  return db
    .prepare(`
      SELECT
        project,
        count(*) as total_executions,
        sum(CASE WHEN status IN ('em_andamento','aguardando_humano') THEN 1 ELSE 0 END) as active_executions,
        sum(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_executions,
        sum(CASE WHEN status = 'abortada' THEN 1 ELSE 0 END) as aborted_executions,
        sum(coalesce(decisoes_total, 0)) as total_decisions,
        sum(tool_calls_total) as total_tool_calls,
        sum(wallclock_total_segundos) as total_wallclock,
        (SELECT count(*) FROM alert_signals a WHERE a.project = e.project) as open_alerts,
        max(iniciada_em) as latest_execution_at
      FROM executions e
      GROUP BY project
      ORDER BY project
    `)
    .all() as ExecutionRollupRow[];
}

/** Rollup por projeto+feature */
export function getRollupByFeature(db: Database.Database): FeatureRollupRow[] {
  return db
    .prepare(`
      SELECT
        project,
        feature,
        count(*) as total_executions,
        sum(CASE WHEN status IN ('em_andamento','aguardando_humano') THEN 1 ELSE 0 END) as active_executions,
        sum(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_executions,
        sum(CASE WHEN status = 'abortada' THEN 1 ELSE 0 END) as aborted_executions,
        sum(tool_calls_total) as total_tool_calls,
        sum(wallclock_total_segundos) as total_wallclock,
        sum(coalesce(decisoes_total, 0)) as total_decisions,
        sum(coalesce(ondas_total, 0)) as total_ondas,
        sum(coalesce(bloqueios_humanos_total, 0)) as total_bloqueios,
        (SELECT etapa_corrente FROM executions e2
         WHERE e2.project = e.project AND e2.feature = e.feature
         ORDER BY iniciada_em DESC LIMIT 1) as etapa_corrente,
        (SELECT status FROM executions e2
         WHERE e2.project = e.project AND e2.feature = e.feature
         ORDER BY iniciada_em DESC LIMIT 1) as latest_status,
        (SELECT count(*) FROM alert_signals a
         WHERE a.project = e.project AND a.feature = e.feature) as open_alerts,
        max(iniciada_em) as latest_execution_at
      FROM executions e
      GROUP BY project, feature
      ORDER BY project, feature
    `)
    .all() as FeatureRollupRow[];
}
