/**
 * Queries read-only para entidade alert_signals.
 * Task 3.3.4
 */
import type Database from 'better-sqlite3';

export interface AlertRow {
  execucao_id: string;
  tipo: string;
  subtipo: string | null;
  valor_consumido: number | null;
  valor_threshold: number | null;
  descricao: string | null;
  wave: string;
}

/** Lista alertas de uma execucao */
export function listAlertsByExecution(
  db: Database.Database,
  execucaoId: string
): AlertRow[] {
  return db
    .prepare(`
      SELECT execucao_id, tipo, subtipo, valor_consumido,
             valor_threshold, descricao, wave
      FROM alert_signals
      WHERE execucao_id = ?
      ORDER BY rowid ASC
    `)
    .all(execucaoId) as AlertRow[];
}
