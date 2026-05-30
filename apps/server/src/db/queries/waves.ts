/**
 * Queries read-only para entidade waves.
 * Ref: data-model.md §Entity: Wave; contracts/api-read.md
 * Task 3.3.2
 *
 * FASE 2 (new-schema): Row interface migrada pt-BR→EN snake_case (task 2.2).
 */
import type Database from 'better-sqlite3';
import { hasColumn } from '../columns.js';

export interface WaveRow {
  wave: string;
  execution_id: string;
  stages: string;        // string unica — NAO array (schema v2)
  started_at: string | null;
  finished_at: string | null;
  wallclock_seconds: number | null;
  tool_calls: number | null;
  termination_reason: string | null;
  n_stages: number | null;
  n_skills: number | null;
}

/** Lista ondas de uma execucao, em ordem cronologica */
export function listWavesByExecution(
  db: Database.Database,
  executionId: string
): WaveRow[] {
  const execIdCol = hasColumn(db, 'waves', 'execution_id') ? 'execution_id' : 'NULL as execution_id';
  const stagesCol = hasColumn(db, 'waves', 'stages') ? 'stages' : 'NULL as stages';
  const startedCol = hasColumn(db, 'waves', 'started_at') ? 'started_at' : 'NULL as started_at';
  const finishedCol = hasColumn(db, 'waves', 'finished_at') ? 'finished_at' : 'NULL as finished_at';
  const terminationCol = hasColumn(db, 'waves', 'termination_reason') ? 'termination_reason' : 'NULL as termination_reason';
  const nStagesCol = hasColumn(db, 'waves', 'n_stages') ? 'n_stages' : 'NULL as n_stages';
  const orderCol = hasColumn(db, 'waves', 'started_at') ? 'started_at' : 'rowid';
  return db
    .prepare(`
      SELECT wave, ${execIdCol}, ${stagesCol}, ${startedCol}, ${finishedCol},
             wallclock_seconds, tool_calls, ${terminationCol},
             ${nStagesCol}, n_skills
      FROM waves
      WHERE execution_id = ?
      ORDER BY ${orderCol} ASC
    `)
    .all(executionId) as WaveRow[];
}
