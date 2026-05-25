/**
 * Queries read-only para entidade retros (retrospectivas).
 * Usado no detalhe de feature (CARD-FTD-06).
 */
import type Database from 'better-sqlite3';

export interface RetroRow {
  execucaoId: string;
  texto: string | null;
  wave: string;
}

/** Lista retrospectivas de uma feature (todas as execucoes), mais recentes primeiro. */
export function listRetrosByFeature(
  db: Database.Database,
  project: string,
  feature: string
): RetroRow[] {
  return db
    .prepare(`
      SELECT execucao_id as execucaoId, texto, wave
      FROM retros
      WHERE project = ? AND feature = ?
      ORDER BY source_ts DESC
    `)
    .all(project, feature) as RetroRow[];
}
