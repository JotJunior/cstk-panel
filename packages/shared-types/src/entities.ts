/**
 * DTOs de dominio — entidades core do cstk-panel.
 * Fonte de verdade: data-model.md (schema v2 da knowledge.db).
 * Ref: spec.md §Key Entities; plan.md §Convencoes de Borda
 *
 * IMPORTANTE — Convencoes de tipos:
 * - Colunas `TEXT` ISO-8601 → `string`; FE formata para "ha Xm"
 * - `INTEGER` 0/1 (lint_ok) → `boolean` via `=== 1` no mapper
 * - `INTEGER` contagem (arquivos_tocados) → `number` — NAO e array
 * - `TEXT waves.etapas` → `string` — NAO array (string unica do schema v2)
 * - `score INTEGER` → union `0|1|2|3`
 * - Campos UNTRUSTED marcados com @untrusted no JSDoc — renderizar via textContent
 */

// ---------------------------------------------------------------------------
// ExecutionDTO — grao: 1 por execucao de orquestrador
// ---------------------------------------------------------------------------
export interface ExecutionDTO {
  project: string;
  feature: string;
  execucaoId: string;
  status: 'em_andamento' | 'aguardando_humano' | 'concluida' | 'abortada' | null;
  motivoTermino: string | null;
  etapaCorrente: string | null;
  iniciadaEm: string | null;
  terminadaEm: string | null;
  duracaoSegundos: number | null;
  stackSugerida: string | null;
  ondasTotal: number | null;
  /** @custo proxy — rotular como "proxy: tool calls" na UI (Principio III) */
  toolCallsTotal: number | null;
  wallclockTotalSegundos: number | null;
  subagentesSpawned: number | null;
  profundidadeMax: number | null;
  decisoesTotal: number | null;
  bloqueiosHumanosTotal: number | null;
  sugestoesSkillsTotal: number | null;
  issuesToolkitAbertas: number | null;
}

// ---------------------------------------------------------------------------
// WaveDTO — grao: 1 por onda
// ---------------------------------------------------------------------------
export interface WaveDTO {
  wave: string;
  execucaoId: string;
  /** string unica — NAO converter para array (schema v2) */
  etapas: string;
  inicio: string | null;
  fim: string | null;
  wallclockSeconds: number | null;
  /** custo proxy */
  toolCalls: number | null;
  motivoTermino: string | null;
  nEtapas: number | null;
  nSkills: number | null;
}

// ---------------------------------------------------------------------------
// DecisionDTO — grao: 1 por decisao auditada — campos textuais UNTRUSTED
// ---------------------------------------------------------------------------
export interface DecisionDTO {
  wave: string;
  execucaoId: string;
  etapa: string | null;
  agente: string | null;
  escolha: string | null;
  score: 0 | 1 | 2 | 3 | null;
  /** @untrusted — renderizar via textContent, nunca innerHTML */
  contexto: string | null;
  /** @untrusted — renderizar via textContent, nunca innerHTML */
  justificativa: string | null;
  /** @untrusted — renderizar via elemento mono/pre, nunca innerHTML */
  evidencia: string | null;
}

// ---------------------------------------------------------------------------
// TaskDTO — grao: 1 por tarefa executada
// ---------------------------------------------------------------------------
export interface TaskDTO {
  wave: string;
  execucaoId: string;
  outcome: 'pass' | 'fail' | null;
  testesRodados: number | null;
  testesPassados: number | null;
  /** mapper: INTEGER 0/1 → boolean via === 1 */
  lintOk: boolean | null;
  /** contagem, NAO array (INTEGER no schema v2) */
  arquivosTocadosCount: number | null;
}

// ---------------------------------------------------------------------------
// EventDTO — grao: 1 por evento de timeline
// ---------------------------------------------------------------------------
export interface EventDTO {
  execucaoId: string;
  eventType: 'lock_contention' | 'validation_failed' | 'wave_retry' | 'schedule_wait';
  timestamp: string;
  /** @untrusted leve — renderizar via textContent */
  descricao: string | null;
}

// ---------------------------------------------------------------------------
// AlertSignalDTO — grao: 1 por alerta de orcamento/circular
// ---------------------------------------------------------------------------
export interface AlertSignalDTO {
  execucaoId: string;
  tipo: 'circular' | 'budget_breach';
  subtipo: string | null;
  valorConsumido: number | null;
  valorThreshold: number | null;
  /** @untrusted leve */
  descricao: string | null;
  wave: string;
}

// ---------------------------------------------------------------------------
// BloqueioDTO — grao: 1 por bloqueio humano — campos textuais UNTRUSTED
// ---------------------------------------------------------------------------
export interface BloqueioDTO {
  execucaoId: string;
  status: string | null;
  /** @untrusted — renderizar via textContent */
  pergunta: string | null;
  /** @untrusted — renderizar via textContent */
  contextoParaResposta: string | null;
  /** @untrusted — renderizar via textContent */
  resposta: string | null;
  decisaoId: string | null;
  disparadoEm: string | null;
  respondidoEm: string | null;
  latenciaSegundos: number | null;
}

// ---------------------------------------------------------------------------
// SkillDTO — grao: 1 por invocacao de skill
// ---------------------------------------------------------------------------
export interface SkillDTO {
  execucaoId: string;
  skillName: string;
  decisaoId: string | null;
  wave: string;
}

// ---------------------------------------------------------------------------
// RetroDTO — grao: 1 por retrospectiva
// ---------------------------------------------------------------------------
export interface RetroDTO {
  execucaoId: string;
  /** @untrusted leve */
  texto: string | null;
  wave: string;
}

// ---------------------------------------------------------------------------
// FtsHitDTO — resultado de busca FTS5
// ---------------------------------------------------------------------------
export interface FtsHitDTO {
  /** @untrusted — conteudo indexado; renderizar via textContent */
  body: string;
  type: string;
  project: string;
  feature: string;
  wave: string;
  sourceId: string;
  sourceTs: string;
  /** score bm25 negativo (mais negativo = mais relevante) */
  rank: number;
}

// ---------------------------------------------------------------------------
// Rollups para Overview (US1) e listas de Projects/Features (US3)
// ---------------------------------------------------------------------------

export interface ProjectRollup {
  project: string;
  totalExecutions: number;
  activeExecutions: number;
  completedExecutions: number;
  abortedExecutions: number;
  totalDecisions: number;
  /** custo proxy */
  totalToolCalls: number | null;
  latestExecutionAt: string | null;
}

export interface FeatureRollup {
  project: string;
  feature: string;
  totalExecutions: number;
  activeExecutions: number;
  completedExecutions: number;
  abortedExecutions: number;
  latestStatus: 'em_andamento' | 'aguardando_humano' | 'concluida' | 'abortada' | null;
  latestExecutionAt: string | null;
}

// ---------------------------------------------------------------------------
// Tipos de request/params compartilhados
// ---------------------------------------------------------------------------

export interface PaginationParams {
  limit: number;
  offset: number;
}

export type PeriodParam = '24h' | '7d' | '30d' | 'all';

export type ScoreParam = 0 | 1 | 2 | 3;

export interface SearchParams extends PaginationParams {
  q: string;
  type?: string;
  project?: string;
  feature?: string;
}
