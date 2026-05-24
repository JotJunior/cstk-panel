/**
 * Mapper: ExecutionRow → ExecutionDTO.
 * snake_case → camelCase conforme plan.md §Convencoes de Borda.
 * Ref: data-model.md §Entity: Execution; spec.md FR-001
 * Task 3.4.1
 */
import type { ExecutionDTO } from '@cstk-panel/shared-types';
import type { ExecutionRow } from '../db/queries/executions.js';

type ValidStatus = 'em_andamento' | 'aguardando_humano' | 'concluida' | 'abortada';

const VALID_STATUSES: Set<string> = new Set([
  'em_andamento', 'aguardando_humano', 'concluida', 'abortada',
]);

function toStatus(raw: string | null): ValidStatus | null {
  if (raw && VALID_STATUSES.has(raw)) return raw as ValidStatus;
  return null;
}

export function mapExecution(row: ExecutionRow): ExecutionDTO {
  return {
    project: row.project,
    feature: row.feature,
    execucaoId: row.execucao_id,
    status: toStatus(row.status),
    motivoTermino: row.motivo_termino,
    etapaCorrente: row.etapa_corrente,
    iniciadaEm: row.iniciada_em,
    terminadaEm: row.terminada_em,
    duracaoSegundos: row.duracao_segundos,
    stackSugerida: row.stack_sugerida,
    ondasTotal: row.ondas_total,
    toolCallsTotal: row.tool_calls_total,
    wallclockTotalSegundos: row.wallclock_total_segundos,
    subagentesSpawned: row.subagentes_spawned,
    profundidadeMax: row.profundidade_max,
    decisoesTotal: row.decisoes_total,
    bloqueiosHumanosTotal: row.bloqueios_humanos_total,
    sugestoesSkillsTotal: row.sugestoes_skills_total,
    issuesToolkitAbertas: row.issues_toolkit_abertas,
  };
}

export function mapExecutions(rows: ExecutionRow[]): ExecutionDTO[] {
  return rows.map(mapExecution);
}
