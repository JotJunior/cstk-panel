/**
 * Queries read-only para entidade tasks.
 * Ref: data-model.md §Entity: Task; contracts/api-read.md
 * Task 3.3.4
 */
import type Database from 'better-sqlite3';

export interface TaskRow {
  wave: string;
  execucao_id: string;
  outcome: string | null;
  testes_rodados: number | null;
  testes_passados: number | null;
  lint_ok: number | null;             // INTEGER 0/1 → boolean no mapper
  arquivos_tocados: number | null;    // contagem (INTEGER) — NAO array
}

/** Lista tasks de uma execucao */
export function listTasksByExecution(
  db: Database.Database,
  execucaoId: string
): TaskRow[] {
  return db
    .prepare(`
      SELECT wave, execucao_id, outcome, testes_rodados, testes_passados,
             lint_ok, arquivos_tocados
      FROM tasks
      WHERE execucao_id = ?
      ORDER BY rowid ASC
    `)
    .all(execucaoId) as TaskRow[];
}
