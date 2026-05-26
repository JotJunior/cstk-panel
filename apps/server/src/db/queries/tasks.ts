/**
 * Queries read-only para entidade tasks.
 * Ref: data-model.md §Entity: Task; contracts/api-read.md
 * Task 3.3.4
 */
import type Database from 'better-sqlite3';
import { hasColumn } from '../columns.js';

export interface TaskRow {
  wave: string;
  execucao_id: string;
  titulo: string;                     // schema v3; '' em bases v2 (FR-V3-005)
  outcome: string | null;
  testes_rodados: number | null;
  testes_passados: number | null;
  lint_ok: number | null;             // INTEGER 0/1 → boolean no mapper
  arquivos_tocados: number | null;    // contagem (INTEGER) — NAO array
}

/**
 * Projecao de `titulo` tolerante a v2: coluna ausente → `'' AS titulo`.
 * COALESCE cobre `titulo` NULL (linha de base v2 migrada ainda sem valor).
 */
export function tituloSelect(db: Database.Database, prefix = ''): string {
  return hasColumn(db, 'tasks', 'titulo')
    ? `COALESCE(${prefix}titulo, '') as titulo`
    : "'' as titulo";
}

/** Lista tasks de uma execucao */
export function listTasksByExecution(
  db: Database.Database,
  execucaoId: string
): TaskRow[] {
  return db
    .prepare(`
      SELECT wave, execucao_id, ${tituloSelect(db)}, outcome,
             testes_rodados, testes_passados,
             lint_ok, arquivos_tocados
      FROM tasks
      WHERE execucao_id = ?
      ORDER BY rowid ASC
    `)
    .all(execucaoId) as TaskRow[];
}
