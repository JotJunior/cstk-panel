/**
 * Mapper: BloqueioRow → BloqueioDTO.
 * Task 3.4.5
 */
import type { BloqueioDTO } from '@cstk-panel/shared-types';
import type { BloqueioRow } from '../db/queries/bloqueios.js';

export function mapBloqueio(row: BloqueioRow): BloqueioDTO {
  return {
    execucaoId: row.execucao_id,
    status: row.status,
    pergunta: row.pergunta,
    contextoParaResposta: row.contexto_para_resposta,
    resposta: row.resposta,
    decisaoId: row.decisao_id,
    disparadoEm: row.disparado_em,
    respondidoEm: row.respondido_em,
    latenciaSegundos: row.latencia_segundos,
  };
}

export function mapBloqueios(rows: BloqueioRow[]): BloqueioDTO[] {
  return rows.map(mapBloqueio);
}
