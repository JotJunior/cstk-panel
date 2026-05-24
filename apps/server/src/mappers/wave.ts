/**
 * Mapper: WaveRow → WaveDTO.
 * IMPORTANTE: etapas permanece string — NAO converter para array (schema v2).
 * Ref: data-model.md §Entity: Wave; plan.md §Convencoes de Borda
 * Task 3.4.2
 */
import type { WaveDTO } from '@cstk-panel/shared-types';
import type { WaveRow } from '../db/queries/waves.js';

export function mapWave(row: WaveRow): WaveDTO {
  return {
    wave: row.wave,
    execucaoId: row.execucao_id,
    etapas: row.etapas,           // string unica — NAO array
    inicio: row.inicio,
    fim: row.fim,
    wallclockSeconds: row.wallclock_seconds,
    toolCalls: row.tool_calls,
    motivoTermino: row.motivo_termino,
    nEtapas: row.n_etapas,
    nSkills: row.n_skills,
  };
}

export function mapWaves(rows: WaveRow[]): WaveDTO[] {
  return rows.map(mapWave);
}
