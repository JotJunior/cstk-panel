/**
 * overview-select — normaliza a resposta do endpoint /overview no view-model
 * consumido pela tela Overview.
 *
 * Funcao PURA (sem React/DOM) para ser testavel em node-env. Existe para
 * travar o CONTRATO de borda: o backend entrega kpis/arrays em camelCase
 * ingles (ver apps/server/src/db/queries/overview.ts); qualquer regressao
 * para snake_case/portugues zera o dashboard e e pega pelo teste irmao.
 *
 * Ref: bug pos-entrega (KPIs zerados) — drift snake_case vs camelCase no
 * consumo do payload, nao detectado por testes de API (que validavam o
 * backend, correto). Spec §User Story 1.
 */

export interface OverviewKpisRaw {
  totalProjects?: number | null;
  totalFeatures?: number | null;
  totalExecutions?: number | null;
  activeExecutions?: number | null;
  completedExecutions?: number | null;
  abortedExecutions?: number | null;
  totalWaves?: number | null;
  totalDecisions?: number | null;
  toolCallsTotal?: number | null;
}

export interface OverviewRaw {
  kpis?: OverviewKpisRaw | null;
  inProgress?: Array<Record<string, unknown>> | null;
  recentAlerts?: Array<Record<string, unknown>> | null;
  leaderboard?: Array<Record<string, unknown>> | null;
  funnel?: Array<{ etapa?: string | null; count?: number | null }> | null;
}

export interface OverviewVM {
  totalProjects: number;
  totalFeatures: number;
  emAndamento: number;
  aguardando: number;
  totalToolCalls: number;
  totalWaves: number | null;
  totalDecisoes: number | null;
  totalExecucoes: number | null;
  concluidas: number;
  abortadas: number;
  totalAlertas: number;
  execucoes: Array<Record<string, unknown>>;
  alertas: Array<Record<string, unknown>>;
  leaderboard: Array<Record<string, unknown>>;
  funnel: Array<{ etapa?: string | null; count?: number | null }>;
  maxToolCalls: number;
  maxFunnel: number;
}

export function selectOverview(raw: OverviewRaw | null | undefined): OverviewVM {
  const kpis = raw?.kpis ?? {};
  const execucoes = raw?.inProgress ?? [];
  const alertas = raw?.recentAlerts ?? [];
  const leaderboard = raw?.leaderboard ?? [];
  const funnel = raw?.funnel ?? [];

  return {
    totalProjects: kpis.totalProjects ?? 0,
    totalFeatures: kpis.totalFeatures ?? 0,
    emAndamento: kpis.activeExecutions ?? 0,
    // 'aguardando humano' nao vem em kpis — derivar das execucoes em andamento.
    aguardando: execucoes.filter(e => e['status'] === 'aguardando_humano').length,
    totalToolCalls: kpis.toolCallsTotal ?? 0,
    totalWaves: kpis.totalWaves ?? null,
    totalDecisoes: kpis.totalDecisions ?? null,
    totalExecucoes: kpis.totalExecutions ?? null,
    concluidas: kpis.completedExecutions ?? 0,
    abortadas: kpis.abortedExecutions ?? 0,
    totalAlertas: alertas.length,
    execucoes,
    alertas,
    leaderboard,
    funnel,
    maxToolCalls: leaderboard.reduce(
      (m, row) => Math.max(m, (row['toolCallsTotal'] as number | null) ?? 0), 0,
    ),
    maxFunnel: funnel.reduce((m, row) => Math.max(m, row.count ?? 0), 0),
  };
}
