/**
 * Queries read-only para entidade bloqueios.
 * Task 3.3.4
 */
import type Database from 'better-sqlite3';

export interface BloqueioRow {
  execucao_id: string;
  status: string | null;
  pergunta: string | null;
  contexto_para_resposta: string | null;
  resposta: string | null;
  decisao_id: string | null;
  disparado_em: string | null;
  respondido_em: string | null;
  latencia_segundos: number | null;
}

/** Lista bloqueios de uma execucao */
export function listBloqueiosByExecution(
  db: Database.Database,
  execucaoId: string
): BloqueioRow[] {
  return db
    .prepare(`
      SELECT execucao_id, status, pergunta, contexto_para_resposta,
             resposta, decisao_id, disparado_em, respondido_em,
             latencia_segundos
      FROM bloqueios
      WHERE execucao_id = ?
      ORDER BY disparado_em ASC
    `)
    .all(execucaoId) as BloqueioRow[];
}
