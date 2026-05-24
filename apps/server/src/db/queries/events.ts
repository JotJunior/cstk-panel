/**
 * Queries read-only para entidade events.
 * Task 3.3.4
 */
import type Database from 'better-sqlite3';

export interface EventRow {
  execucao_id: string;
  event_type: string;
  timestamp: string;
  descricao: string | null;
}

/** Lista eventos de uma execucao em ordem cronologica */
export function listEventsByExecution(
  db: Database.Database,
  execucaoId: string
): EventRow[] {
  return db
    .prepare(`
      SELECT execucao_id, event_type, timestamp, descricao
      FROM events
      WHERE execucao_id = ?
      ORDER BY timestamp ASC
    `)
    .all(execucaoId) as EventRow[];
}
