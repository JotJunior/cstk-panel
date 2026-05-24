/**
 * Mapper: DecisionRow → DecisionDTO.
 * score: INTEGER → 0|1|2|3|null.
 * Campos UNTRUSTED preservados crus — FE renderiza via textContent.
 * Ref: data-model.md §Entity: Decision; plan.md §Convencoes de Borda
 * Task 3.4.3
 */
import type { DecisionDTO } from '@cstk-panel/shared-types';
import type { DecisionRow } from '../db/queries/decisions.js';

type ValidScore = 0 | 1 | 2 | 3;

function toScore(raw: number | null): ValidScore | null {
  if (raw === 0 || raw === 1 || raw === 2 || raw === 3) return raw;
  return null;
}

export function mapDecision(row: DecisionRow): DecisionDTO {
  return {
    wave: row.wave,
    execucaoId: row.execucao_id,
    etapa: row.etapa,
    agente: row.agente,
    escolha: row.escolha,
    score: toScore(row.score),
    // Campos UNTRUSTED — preservar crus, sem sanitizacao aqui
    // FE renderiza via textContent/pre, NUNCA innerHTML
    contexto: row.contexto,
    justificativa: row.justificativa,
    evidencia: row.evidencia,
  };
}

export function mapDecisions(rows: DecisionRow[]): DecisionDTO[] {
  return rows.map(mapDecision);
}
