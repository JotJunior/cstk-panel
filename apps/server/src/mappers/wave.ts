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
    executionId: row.execution_id,
    stages: row.stages,           // string unica — NAO array
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    wallclockSeconds: row.wallclock_seconds,
    toolCalls: row.tool_calls,
    terminationReason: row.termination_reason,
    nStages: row.n_stages,
    nSkills: row.n_skills,
  };
}

export function mapWaves(rows: WaveRow[]): WaveDTO[] {
  return rows.map(mapWave);
}
