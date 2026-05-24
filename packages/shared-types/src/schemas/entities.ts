/**
 * Schemas Zod para DTOs de dominio.
 * Ref: plan.md §Convencoes de Borda; spec.md FR-012
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// ExecutionDTO schema
// ---------------------------------------------------------------------------
export const ExecutionDTOSchema = z.object({
  project: z.string(),
  feature: z.string(),
  execucaoId: z.string(),
  status: z.enum(['em_andamento', 'aguardando_humano', 'concluida', 'abortada']).nullable(),
  motivoTermino: z.string().nullable(),
  etapaCorrente: z.string().nullable(),
  iniciadaEm: z.string().nullable(),
  terminadaEm: z.string().nullable(),
  duracaoSegundos: z.number().nullable(),
  stackSugerida: z.string().nullable(),
  ondasTotal: z.number().nullable(),
  toolCallsTotal: z.number().nullable(),
  wallclockTotalSegundos: z.number().nullable(),
  subagentesSpawned: z.number().nullable(),
  profundidadeMax: z.number().nullable(),
  decisoesTotal: z.number().nullable(),
  bloqueiosHumanosTotal: z.number().nullable(),
  sugestoesSkillsTotal: z.number().nullable(),
  issuesToolkitAbertas: z.number().nullable(),
});

// ---------------------------------------------------------------------------
// WaveDTO schema
// ---------------------------------------------------------------------------
export const WaveDTOSchema = z.object({
  wave: z.string(),
  execucaoId: z.string(),
  etapas: z.string(), // string unica — NAO array
  inicio: z.string().nullable(),
  fim: z.string().nullable(),
  wallclockSeconds: z.number().nullable(),
  toolCalls: z.number().nullable(),
  motivoTermino: z.string().nullable(),
  nEtapas: z.number().nullable(),
  nSkills: z.number().nullable(),
});

// ---------------------------------------------------------------------------
// DecisionDTO schema
// ---------------------------------------------------------------------------
export const DecisionDTOSchema = z.object({
  wave: z.string(),
  execucaoId: z.string(),
  etapa: z.string().nullable(),
  agente: z.string().nullable(),
  escolha: z.string().nullable(),
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  contexto: z.string().nullable(),
  justificativa: z.string().nullable(),
  evidencia: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// TaskDTO schema
// ---------------------------------------------------------------------------
export const TaskDTOSchema = z.object({
  wave: z.string(),
  execucaoId: z.string(),
  outcome: z.enum(['pass', 'fail']).nullable(),
  testesRodados: z.number().nullable(),
  testesPassados: z.number().nullable(),
  lintOk: z.boolean().nullable(),
  arquivosTocadosCount: z.number().nullable(),
});

// ---------------------------------------------------------------------------
// EventDTO schema
// ---------------------------------------------------------------------------
export const EventDTOSchema = z.object({
  execucaoId: z.string(),
  eventType: z.enum(['lock_contention', 'validation_failed', 'wave_retry', 'schedule_wait']),
  timestamp: z.string(),
  descricao: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// AlertSignalDTO schema
// ---------------------------------------------------------------------------
export const AlertSignalDTOSchema = z.object({
  execucaoId: z.string(),
  tipo: z.enum(['circular', 'budget_breach']),
  subtipo: z.string().nullable(),
  valorConsumido: z.number().nullable(),
  valorThreshold: z.number().nullable(),
  descricao: z.string().nullable(),
  wave: z.string(),
});

// ---------------------------------------------------------------------------
// BloqueioDTO schema
// ---------------------------------------------------------------------------
export const BloqueioDTOSchema = z.object({
  execucaoId: z.string(),
  status: z.string().nullable(),
  pergunta: z.string().nullable(),
  contextoParaResposta: z.string().nullable(),
  resposta: z.string().nullable(),
  decisaoId: z.string().nullable(),
  disparadoEm: z.string().nullable(),
  respondidoEm: z.string().nullable(),
  latenciaSegundos: z.number().nullable(),
});

// ---------------------------------------------------------------------------
// SkillDTO schema
// ---------------------------------------------------------------------------
export const SkillDTOSchema = z.object({
  execucaoId: z.string(),
  skillName: z.string(),
  decisaoId: z.string().nullable(),
  wave: z.string(),
});

// ---------------------------------------------------------------------------
// RetroDTO schema
// ---------------------------------------------------------------------------
export const RetroDTOSchema = z.object({
  execucaoId: z.string(),
  texto: z.string().nullable(),
  wave: z.string(),
});

// ---------------------------------------------------------------------------
// FtsHitDTO schema
// ---------------------------------------------------------------------------
export const FtsHitDTOSchema = z.object({
  body: z.string(),
  type: z.string(),
  project: z.string(),
  feature: z.string(),
  wave: z.string(),
  sourceId: z.string(),
  sourceTs: z.string(),
  rank: z.number(),
});

// ---------------------------------------------------------------------------
// Rollup schemas
// ---------------------------------------------------------------------------
export const ProjectRollupSchema = z.object({
  project: z.string(),
  totalExecutions: z.number(),
  activeExecutions: z.number(),
  completedExecutions: z.number(),
  abortedExecutions: z.number(),
  totalDecisions: z.number(),
  totalToolCalls: z.number().nullable(),
  latestExecutionAt: z.string().nullable(),
});

export const FeatureRollupSchema = z.object({
  project: z.string(),
  feature: z.string(),
  totalExecutions: z.number(),
  activeExecutions: z.number(),
  completedExecutions: z.number(),
  abortedExecutions: z.number(),
  latestStatus: z.enum(['em_andamento', 'aguardando_humano', 'concluida', 'abortada']).nullable(),
  latestExecutionAt: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Params schemas
// ---------------------------------------------------------------------------
export const PaginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(200),
  offset: z.number().int().min(0),
});

export const PeriodParamSchema = z.enum(['24h', '7d', '30d', 'all']);

export const ScoreParamSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
]);

export const SearchParamsSchema = PaginationParamsSchema.extend({
  q: z.string().min(1),
  type: z.string().optional(),
  project: z.string().optional(),
  feature: z.string().optional(),
});
