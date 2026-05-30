/**
 * Queries read-only para entidade executions.
 * Ref: data-model.md §Entities; contracts/api-read.md; spec.md FR-001, FR-003
 * Task 3.3.1
 *
 * Principio I (Read-Only Absoluto): apenas SELECT com prepared statements.
 * Parametros sempre via binding — nunca interpolacao de string.
 *
 * FASE 2 (new-schema): Row interface migrada pt-BR→EN snake_case (task 2.1).
 */
import type Database from 'better-sqlite3';
import { hasColumn } from '../columns.js';

/**
 * Projecao tolerante a bases v6 onde a coluna ainda tem nome pt-BR.
 * Para cada coluna renomeada: se o novo nome existir usa-o; senao projeta NULL.
 */
function executionColumnsSelect(db: Database.Database): string {
  const cols: string[] = [
    'project',
    'feature',
    hasColumn(db, 'executions', 'execution_id')   ? 'execution_id'                 : 'NULL as execution_id',
    'status',
    hasColumn(db, 'executions', 'termination_reason') ? 'termination_reason'       : 'NULL as termination_reason',
    hasColumn(db, 'executions', 'current_stage')  ? 'current_stage'                : 'NULL as current_stage',
    hasColumn(db, 'executions', 'started_at')     ? 'started_at'                   : 'NULL as started_at',
    hasColumn(db, 'executions', 'finished_at')    ? 'finished_at'                  : 'NULL as finished_at',
    hasColumn(db, 'executions', 'duration_seconds') ? 'duration_seconds'           : 'NULL as duration_seconds',
    hasColumn(db, 'executions', 'suggested_stack')  ? 'suggested_stack'            : 'NULL as suggested_stack',
    hasColumn(db, 'executions', 'waves_total')    ? 'waves_total'                  : 'NULL as waves_total',
    'tool_calls_total',
    hasColumn(db, 'executions', 'wallclock_total_seconds') ? 'wallclock_total_seconds' : 'NULL as wallclock_total_seconds',
    hasColumn(db, 'executions', 'subagents_spawned') ? 'subagents_spawned'         : 'NULL as subagents_spawned',
    hasColumn(db, 'executions', 'max_depth')      ? 'max_depth'                    : 'NULL as max_depth',
    hasColumn(db, 'executions', 'decisions_total') ? 'decisions_total'             : 'NULL as decisions_total',
    hasColumn(db, 'executions', 'human_blocks_total') ? 'human_blocks_total'       : 'NULL as human_blocks_total',
    hasColumn(db, 'executions', 'skill_suggestions_total') ? 'skill_suggestions_total' : 'NULL as skill_suggestions_total',
    hasColumn(db, 'executions', 'toolkit_issues_opened') ? 'toolkit_issues_opened' : 'NULL as toolkit_issues_opened',
  ];
  return cols.join(', ');
}

export interface ExecutionRow {
  project: string;
  feature: string;
  execution_id: string;
  status: string | null;
  termination_reason: string | null;
  current_stage: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  suggested_stack: string | null;
  waves_total: number | null;
  tool_calls_total: number | null;
  wallclock_total_seconds: number | null;
  subagents_spawned: number | null;
  max_depth: number | null;
  decisions_total: number | null;
  human_blocks_total: number | null;
  skill_suggestions_total: number | null;
  toolkit_issues_opened: number | null;
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
  total_waves: number | null;
  total_blocks: number;
  current_stage: string | null;
  open_alerts: number;
  latest_status: string | null;
  latest_execution_at: string | null;
}

/** Lista todas as execucoes, mais recentes primeiro */
export function listExecutions(db: Database.Database): ExecutionRow[] {
  const cols = executionColumnsSelect(db);
  const orderBy = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
  return db
    .prepare(`
      SELECT ${cols}
      FROM executions
      ORDER BY ${orderBy} DESC
    `)
    .all() as ExecutionRow[];
}

/** Busca execucao por ID */
export function getExecution(
  db: Database.Database,
  executionId: string
): ExecutionRow | undefined {
  const cols = executionColumnsSelect(db);
  const idCol = hasColumn(db, 'executions', 'execution_id') ? 'execution_id' : 'execution_id';
  return db
    .prepare(`
      SELECT ${cols}
      FROM executions
      WHERE ${idCol} = ?
    `)
    .get(executionId) as ExecutionRow | undefined;
}

/** Lista execucoes por projeto */
export function listExecutionsByProject(
  db: Database.Database,
  project: string
): ExecutionRow[] {
  const cols = executionColumnsSelect(db);
  const orderBy = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
  return db
    .prepare(`
      SELECT ${cols}
      FROM executions
      WHERE project = ?
      ORDER BY ${orderBy} DESC
    `)
    .all(project) as ExecutionRow[];
}

/** Rollup por projeto */
export function getRollupByProject(db: Database.Database, project: string | null = null): ExecutionRollupRow[] {
  const decCol = hasColumn(db, 'executions', 'decisions_total') ? 'decisions_total' : '0';
  const wallCol = hasColumn(db, 'executions', 'wallclock_total_seconds') ? 'wallclock_total_seconds' : '0';
  const startedCol = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
  return db
    .prepare(`
      SELECT
        project,
        count(*) as total_executions,
        sum(CASE WHEN status IN ('em_andamento','aguardando_humano') THEN 1 ELSE 0 END) as active_executions,
        sum(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_executions,
        sum(CASE WHEN status = 'abortada' THEN 1 ELSE 0 END) as aborted_executions,
        sum(coalesce(${decCol}, 0)) as total_decisions,
        sum(tool_calls_total) as total_tool_calls,
        sum(${wallCol}) as total_wallclock,
        (SELECT count(*) FROM alert_signals a WHERE a.project = e.project) as open_alerts,
        max(${startedCol}) as latest_execution_at
      FROM executions e
      WHERE (@project IS NULL OR e.project = @project)
      GROUP BY project
      ORDER BY project
    `)
    .all({ project }) as ExecutionRollupRow[];
}

/** Rollup por projeto+feature. Filtro opcional por project (overview escopado). */
export function getRollupByFeature(db: Database.Database, project: string | null = null): FeatureRollupRow[] {
  const decCol = hasColumn(db, 'executions', 'decisions_total') ? 'decisions_total' : '0';
  const wallCol = hasColumn(db, 'executions', 'wallclock_total_seconds') ? 'wallclock_total_seconds' : '0';
  const wavesCol = hasColumn(db, 'executions', 'waves_total') ? 'waves_total' : '0';
  const blocksCol = hasColumn(db, 'executions', 'human_blocks_total') ? 'human_blocks_total' : '0';
  const stageCol = hasColumn(db, 'executions', 'current_stage') ? 'current_stage' : 'NULL';
  const startedCol = hasColumn(db, 'executions', 'started_at') ? 'started_at' : 'rowid';
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
        sum(${wallCol}) as total_wallclock,
        sum(coalesce(${decCol}, 0)) as total_decisions,
        sum(coalesce(${wavesCol}, 0)) as total_waves,
        sum(coalesce(${blocksCol}, 0)) as total_blocks,
        (SELECT ${stageCol} FROM executions e2
         WHERE e2.project = e.project AND e2.feature = e.feature
         ORDER BY ${startedCol} DESC LIMIT 1) as current_stage,
        (SELECT status FROM executions e2
         WHERE e2.project = e.project AND e2.feature = e.feature
         ORDER BY ${startedCol} DESC LIMIT 1) as latest_status,
        (SELECT count(*) FROM alert_signals a
         WHERE a.project = e.project AND a.feature = e.feature) as open_alerts,
        max(${startedCol}) as latest_execution_at
      FROM executions e
      WHERE (@project IS NULL OR e.project = @project)
      GROUP BY project, feature
      ORDER BY project, feature
    `)
    .all({ project }) as FeatureRollupRow[];
}
