import { describe, it, expect } from 'vitest';
import { selectOverview, type OverviewRaw } from './overview-select.js';

// Payload representativo no SHAPE REAL do endpoint /overview
// (camelCase ingles — ver apps/server/src/db/queries/overview.ts).
const realPayload: OverviewRaw = {
  kpis: {
    totalProjects: 9,
    totalFeatures: 6,
    totalExecutions: 14,
    activeExecutions: 6,
    completedExecutions: 8,
    abortedExecutions: 0,
    totalWaves: 246,
    totalDecisions: 964,
    toolCallsTotal: 194,
  },
  inProgress: [
    { execucaoId: 'exec-a', status: 'em_andamento', etapaCorrente: 'plan', ondasTotal: 12 },
    { execucaoId: 'exec-b', status: 'aguardando_humano', etapaCorrente: 'execute-task', ondasTotal: 3 },
  ],
  recentAlerts: [{ execucaoId: 'exec-a', tipo: 'circular', descricao: 'x', wave: '-' }],
  leaderboard: [
    { feature: 'swagger-codegen', toolCallsTotal: 24 },
    { feature: 'knowledge-db', toolCallsTotal: 6 },
  ],
  funnel: [
    { etapa: 'execute-task', count: 9 },
    { etapa: 'review-task', count: 4 },
  ],
};

describe('selectOverview', () => {
  it('mapeia os KPIs camelCase reais para o view-model (regressao do bug de zeros)', () => {
    const vm = selectOverview(realPayload);
    expect(vm.totalProjects).toBe(9);
    expect(vm.totalFeatures).toBe(6);
    expect(vm.emAndamento).toBe(6);       // activeExecutions
    expect(vm.totalToolCalls).toBe(194);  // toolCallsTotal
    expect(vm.totalWaves).toBe(246);
    expect(vm.totalDecisoes).toBe(964);
    expect(vm.totalExecucoes).toBe(14);
    expect(vm.concluidas).toBe(8);        // completedExecutions
    expect(vm.abortadas).toBe(0);
  });

  it('deriva aguardando humano das execucoes em andamento', () => {
    expect(selectOverview(realPayload).aguardando).toBe(1);
  });

  it('le leaderboard.toolCallsTotal (nao tool_calls_total) e calcula o max', () => {
    const vm = selectOverview(realPayload);
    expect(vm.maxToolCalls).toBe(24);
    expect(vm.leaderboard.length).toBe(2);
  });

  it('le funnel/inProgress/recentAlerts pelos nomes camelCase corretos', () => {
    const vm = selectOverview(realPayload);
    expect(vm.maxFunnel).toBe(9);
    expect(vm.execucoes.length).toBe(2);
    expect(vm.totalAlertas).toBe(1);
  });

  it('GUARDA-CONTRA-REGRESSAO: payload snake_case/portugues NAO popula (so camelCase conta)', () => {
    const legacyWrong = {
      kpis: { total_projetos: 9, total_features: 6, em_andamento: 6, total_tool_calls: 194 },
      execucoes_em_andamento: [{ status: 'em_andamento' }],
      alertas_recentes: [{}],
    } as unknown as OverviewRaw;
    const vm = selectOverview(legacyWrong);
    // Se alguem reverter para snake_case no backend ou no select, isto falha.
    expect(vm.totalProjects).toBe(0);
    expect(vm.totalToolCalls).toBe(0);
    expect(vm.execucoes.length).toBe(0);
    expect(vm.totalAlertas).toBe(0);
  });

  it('tolera payload vazio/null sem quebrar', () => {
    const vm = selectOverview(null);
    expect(vm.totalProjects).toBe(0);
    expect(vm.execucoes).toEqual([]);
    expect(vm.maxFunnel).toBe(0);
  });
});
