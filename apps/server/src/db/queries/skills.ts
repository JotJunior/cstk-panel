/**
 * Queries read-only para entidade skills.
 * Task 3.3.4
 */
import type Database from 'better-sqlite3';

export interface SkillRow {
  execucao_id: string;
  skill_name: string;
  decisao_id: string | null;
  wave: string;
}

/** Lista skills invocadas em uma execucao */
export function listSkillsByExecution(
  db: Database.Database,
  execucaoId: string
): SkillRow[] {
  return db
    .prepare(`
      SELECT execucao_id, skill_name, decisao_id, wave
      FROM skills
      WHERE execucao_id = ?
      ORDER BY rowid ASC
    `)
    .all(execucaoId) as SkillRow[];
}
