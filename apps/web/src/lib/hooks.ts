/**
 * Hooks TanStack Query para cada recurso principal da API.
 * Cada hook usa fetchApi<T> com schema Zod do shared-types.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './api.js';
import {
  ApiEnvelopeSchema,
  ExecutionDTOSchema,
  WaveDTOSchema,
  DecisionDTOSchema,
  TaskDTOSchema,
  EventDTOSchema,
  AlertSignalDTOSchema,
  BloqueioDTOSchema,
  SkillDTOSchema,
  ProjectRollupSchema,
  FeatureRollupSchema,
  FtsHitDTOSchema,
  type PeriodParam,
} from '@cstk-panel/shared-types';
import { z } from 'zod';

// ---- Schemas de arrays (recursos de lista) ----
const ExecutionListSchema = z.array(ExecutionDTOSchema);
const WaveListSchema = z.array(WaveDTOSchema);
const DecisionListSchema = z.array(DecisionDTOSchema);
const TaskListSchema = z.array(TaskDTOSchema);
const EventListSchema = z.array(EventDTOSchema);
const AlertListSchema = z.array(AlertSignalDTOSchema);
const BloqueioListSchema = z.array(BloqueioDTOSchema);
const SkillListSchema = z.array(SkillDTOSchema);
const ProjectListSchema = z.array(ProjectRollupSchema);
const FeatureListSchema = z.array(FeatureRollupSchema);
const FtsHitListSchema = z.array(FtsHitDTOSchema);

// Overview KPI — schema livre (endpoint retorna objeto ad-hoc)
const OverviewDataSchema = z.object({}).passthrough();

// Metrics — schema livre por endpoint
const MetricDataSchema = z.unknown();

/** Visao geral com KPIs, alertas recentes, leaderboard */
export function useOverview(period: PeriodParam = '7d') {
  return useQuery({
    queryKey: ['overview', period],
    queryFn: () => fetchApi(`/overview?period=${period}`, OverviewDataSchema),
  });
}

/** Lista de projetos (rollup) */
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchApi('/projects', ProjectListSchema),
  });
}

/** Detalhe de um projeto */
export function useProject(project: string) {
  return useQuery({
    queryKey: ['projects', project],
    queryFn: () => fetchApi(`/projects/${encodeURIComponent(project)}`, ProjectRollupSchema.nullable()),
    enabled: Boolean(project),
  });
}

/** Lista de features (filtravel) */
export function useFeatures(project?: string, status?: string) {
  const params = new URLSearchParams();
  if (project) params.set('project', project);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['features', project, status],
    queryFn: () => fetchApi(`/features${qs}`, FeatureListSchema),
  });
}

/** Detalhe de uma feature */
export function useFeature(project: string, feature: string) {
  return useQuery({
    queryKey: ['features', project, feature],
    queryFn: () => fetchApi(`/features/${encodeURIComponent(project)}/${encodeURIComponent(feature)}`, FeatureRollupSchema.nullable()),
    enabled: Boolean(project) && Boolean(feature),
  });
}

/** Lista paginada de execucoes */
export function useExecutions(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['executions', limit, offset],
    queryFn: () => fetchApi(`/executions?limit=${limit}&offset=${offset}`, ExecutionListSchema),
  });
}

/** Detalhe de uma execucao */
export function useExecution(execucaoId: string) {
  return useQuery({
    queryKey: ['executions', execucaoId],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}`, ExecutionDTOSchema.nullable()),
    enabled: Boolean(execucaoId),
  });
}

/** Ondas de uma execucao */
export function useWaves(execucaoId: string) {
  return useQuery({
    queryKey: ['waves', execucaoId],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}/waves`, WaveListSchema),
    enabled: Boolean(execucaoId),
  });
}

/** Decisoes paginadas de uma execucao */
export function useDecisions(
  execucaoId: string,
  opts?: { wave?: string; etapa?: string; score?: number; limit?: number; offset?: number }
) {
  const params = new URLSearchParams();
  if (opts?.wave) params.set('wave', opts.wave);
  if (opts?.etapa) params.set('etapa', opts.etapa);
  if (opts?.score != null) params.set('score', String(opts.score));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['decisions', execucaoId, opts],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}/decisions${qs}`, DecisionListSchema),
    enabled: Boolean(execucaoId),
  });
}

/** Tarefas de uma execucao */
export function useTasks(execucaoId: string) {
  return useQuery({
    queryKey: ['tasks', execucaoId],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}/tasks`, TaskListSchema),
    enabled: Boolean(execucaoId),
  });
}

/** Eventos de uma execucao */
export function useEvents(execucaoId: string) {
  return useQuery({
    queryKey: ['events', execucaoId],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}/events`, EventListSchema),
    enabled: Boolean(execucaoId),
  });
}

/** Alertas de uma execucao */
export function useAlertsByExecution(execucaoId: string) {
  return useQuery({
    queryKey: ['alerts-exec', execucaoId],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}/alerts`, AlertListSchema),
    enabled: Boolean(execucaoId),
  });
}

/** Bloqueios de uma execucao */
export function useBloqueios(execucaoId: string) {
  return useQuery({
    queryKey: ['bloqueios', execucaoId],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}/bloqueios`, BloqueioListSchema),
    enabled: Boolean(execucaoId),
  });
}

/** Skills de uma execucao */
export function useSkills(execucaoId: string) {
  return useQuery({
    queryKey: ['skills', execucaoId],
    queryFn: () => fetchApi(`/executions/${encodeURIComponent(execucaoId)}/skills`, SkillListSchema),
    enabled: Boolean(execucaoId),
  });
}

/** Alertas cross-execucao */
export function useAlerts(opts?: { tipo?: string; project?: string; feature?: string; period?: PeriodParam }) {
  const params = new URLSearchParams();
  if (opts?.tipo) params.set('tipo', opts.tipo);
  if (opts?.project) params.set('project', opts.project);
  if (opts?.feature) params.set('feature', opts.feature);
  if (opts?.period) params.set('period', opts.period);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['alerts', opts],
    queryFn: () => fetchApi(`/alerts${qs}`, AlertListSchema),
  });
}

/** Busca FTS5 */
export function useSearch(
  q: string,
  opts?: { type?: string; project?: string; feature?: string; limit?: number; offset?: number }
) {
  const params = new URLSearchParams({ q });
  if (opts?.type) params.set('type', opts.type);
  if (opts?.project) params.set('project', opts.project);
  if (opts?.feature) params.set('feature', opts.feature);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  return useQuery({
    queryKey: ['search', q, opts],
    queryFn: () => fetchApi(`/search?${params.toString()}`, FtsHitListSchema),
    enabled: q.length >= 2,
  });
}

/** Metrica por nome */
export function useMetric(
  name: 'cost-over-time' | 'throughput-by-stage' | 'test-pass-rate' | 'human-latency'
       | 'clarify-resolution' | 'decisions-by-score' | 'execution-duration' | 'depth-subagents',
  period?: PeriodParam
) {
  const qs = period ? `?period=${period}` : '';
  return useQuery({
    queryKey: ['metrics', name, period],
    queryFn: () => fetchApi(`/metrics/${name}${qs}`, MetricDataSchema),
  });
}
