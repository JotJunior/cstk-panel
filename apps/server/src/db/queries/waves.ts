/**
 * Queries read-only para entidade waves.
 * Ref: data-model.md §Entity: Wave; contracts/api-read.md
 * Task 3.3.2
 */
import type Database from 'better-sqlite3';

export interface WaveRow {
  wave: string;
  execucao_id: string;
  etapas: string;        // string unica — NAO array (schema v2)
  inicio: string | null;
  fim: string | null;
  wallclock_seconds: number | null;
  tool_calls: number | null;
  motivo_termino: string | null;
  n_etapas: number | null;
  n_skills: number | null;
}

/** Lista ondas de uma execucao, em ordem cronologica */
export function listWavesByExecution(
  db: Database.Database,
  execucaoId: string
): WaveRow[] {
  return db
    .prepare(`
      SELECT wave, execucao_id, etapas, inicio, fim,
             wallclock_seconds, tool_calls, motivo_termino,
             n_etapas, n_skills
      FROM waves
      WHERE execucao_id = ?
      ORDER BY inicio ASC
    `)
    .all(execucaoId) as WaveRow[];
}
