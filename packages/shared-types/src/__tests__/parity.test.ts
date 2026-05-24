/**
 * Teste de paridade smoke — task 2.3.5.
 * Cada schema Zod e instanciado com payload sintetico valido.
 * Falha se qualquer schema rejeitar payload bem-formado.
 * Ref: plan.md §Convencoes de Borda; spec.md FR-012
 */
import { describe, it, expect } from 'vitest';
import {
  ExecutionDTOSchema,
  WaveDTOSchema,
  DecisionDTOSchema,
  TaskDTOSchema,
  EventDTOSchema,
  AlertSignalDTOSchema,
  BloqueioDTOSchema,
  SkillDTOSchema,
  RetroDTOSchema,
  FtsHitDTOSchema,
  ProjectRollupSchema,
  FeatureRollupSchema,
} from '../schemas/entities.js';
import {
  PaginationParamsSchema,
  PeriodParamSchema,
  ScoreParamSchema,
  SearchParamsSchema,
} from '../schemas/params.js';

const ISO = '2025-01-15T10:00:00.000Z';

describe('Paridade schemas Zod — entidades', () => {
  it('ExecutionDTOSchema: payload valido passa', () => {
    const payload = {
      project: 'cstk',
      feature: 'cstk-panel',
      execucaoId: 'exec-2025-001',
      status: 'em_andamento',
      motivoTermino: null,
      etapaCorrente: 'execute-task',
      iniciadaEm: ISO,
      terminadaEm: null,
      duracaoSegundos: null,
      stackSugerida: 'node+ts',
      ondasTotal: 7,
      toolCallsTotal: 120,
      wallclockTotalSegundos: 3600,
      subagentesSpawned: 0,
      profundidadeMax: 1,
      decisoesTotal: 38,
      bloqueiosHumanosTotal: 1,
      sugestoesSkillsTotal: 0,
      issuesToolkitAbertas: 0,
    };
    const r = ExecutionDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('WaveDTOSchema: payload valido passa (etapas como string)', () => {
    const payload = {
      wave: 'onda-007',
      execucaoId: 'exec-2025-001',
      etapas: 'execute-task',   // string, nao array
      inicio: ISO,
      fim: null,
      wallclockSeconds: 120,
      toolCalls: 25,
      motivoTermino: null,
      nEtapas: 1,
      nSkills: 3,
    };
    const r = WaveDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('DecisionDTOSchema: score=2, campos UNTRUSTED como string', () => {
    const payload = {
      wave: 'onda-007',
      execucaoId: 'exec-2025-001',
      etapa: 'execute-task',
      agente: 'agente-00c-orchestrator',
      escolha: 'confirmar-ok',
      score: 2,
      contexto: 'Verificar npm install',
      justificativa: 'Dependencias instaladas com sucesso',
      evidencia: null,
    };
    const r = DecisionDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.score).toBe(2);
    }
  });

  it('DecisionDTOSchema: score=null passa', () => {
    const payload = {
      wave: 'onda-001',
      execucaoId: 'exec-001',
      etapa: null,
      agente: null,
      escolha: null,
      score: null,
      contexto: null,
      justificativa: null,
      evidencia: null,
    };
    const r = DecisionDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('TaskDTOSchema: lintOk como boolean, arquivosTocadosCount como number', () => {
    const payload = {
      wave: 'onda-001',
      execucaoId: 'exec-001',
      outcome: 'pass',
      testesRodados: 3,
      testesPassados: 3,
      lintOk: true,
      arquivosTocadosCount: 5,
    };
    const r = TaskDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(typeof r.data.lintOk).toBe('boolean');
      expect(typeof r.data.arquivosTocadosCount).toBe('number');
    }
  });

  it('EventDTOSchema: payload valido passa', () => {
    const payload = {
      execucaoId: 'exec-001',
      eventType: 'schedule_wait',
      timestamp: ISO,
      descricao: null,
    };
    const r = EventDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('AlertSignalDTOSchema: payload valido passa', () => {
    const payload = {
      execucaoId: 'exec-001',
      tipo: 'circular',
      subtipo: null,
      valorConsumido: null,
      valorThreshold: null,
      descricao: 'Ciclo detectado',
      wave: 'onda-001',
    };
    const r = AlertSignalDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('BloqueioDTOSchema: payload valido passa', () => {
    const payload = {
      execucaoId: 'exec-001',
      status: 'respondido',
      pergunta: 'Confirmar npm install?',
      contextoParaResposta: null,
      resposta: 'sim',
      decisaoId: 'dec-001',
      disparadoEm: ISO,
      respondidoEm: ISO,
      latenciaSegundos: 42,
    };
    const r = BloqueioDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('SkillDTOSchema: payload valido passa', () => {
    const payload = {
      execucaoId: 'exec-001',
      skillName: 'briefing',
      decisaoId: 'dec-001',
      wave: 'onda-001',
    };
    const r = SkillDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('RetroDTOSchema: payload valido passa', () => {
    const payload = {
      execucaoId: 'exec-001',
      texto: 'Reprocessamento necessario',
      wave: 'onda-001',
    };
    const r = RetroDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('FtsHitDTOSchema: rank como number', () => {
    const payload = {
      body: 'Trecho relevante da busca',
      type: 'decisions',
      project: 'cstk',
      feature: 'cstk-panel',
      wave: 'onda-001',
      sourceId: 'dec-001',
      sourceTs: ISO,
      rank: -1.5,
    };
    const r = FtsHitDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(typeof r.data.rank).toBe('number');
    }
  });

  it('ProjectRollupSchema: payload valido passa', () => {
    const payload = {
      project: 'cstk',
      totalExecutions: 14,
      activeExecutions: 1,
      completedExecutions: 10,
      abortedExecutions: 3,
      totalDecisions: 927,
      totalToolCalls: 2000,
      latestExecutionAt: ISO,
    };
    const r = ProjectRollupSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('FeatureRollupSchema: payload valido passa', () => {
    const payload = {
      project: 'cstk',
      feature: 'cstk-panel',
      totalExecutions: 2,
      activeExecutions: 1,
      completedExecutions: 0,
      abortedExecutions: 1,
      latestStatus: 'em_andamento',
      latestExecutionAt: ISO,
    };
    const r = FeatureRollupSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });
});

describe('Paridade schemas Zod — params', () => {
  it('PaginationParamsSchema: limit=20, offset=0 passa', () => {
    const r = PaginationParamsSchema.safeParse({ limit: 20, offset: 0 });
    expect(r.success).toBe(true);
  });

  it('PaginationParamsSchema: limit=0 falha (abaixo do minimo)', () => {
    const r = PaginationParamsSchema.safeParse({ limit: 0, offset: 0 });
    expect(r.success).toBe(false);
  });

  it('PaginationParamsSchema: limit=201 falha (acima do teto=200)', () => {
    const r = PaginationParamsSchema.safeParse({ limit: 201, offset: 0 });
    expect(r.success).toBe(false);
  });

  it('PeriodParamSchema: todos os valores validos passam', () => {
    for (const period of ['24h', '7d', '30d', 'all'] as const) {
      const r = PeriodParamSchema.safeParse(period);
      expect(r.success).toBe(true);
    }
  });

  it('PeriodParamSchema: valor invalido falha', () => {
    const r = PeriodParamSchema.safeParse('1year');
    expect(r.success).toBe(false);
  });

  it('ScoreParamSchema: 0, 1, 2, 3 passam', () => {
    for (const score of [0, 1, 2, 3] as const) {
      const r = ScoreParamSchema.safeParse(score);
      expect(r.success).toBe(true);
    }
  });

  it('ScoreParamSchema: 4 falha', () => {
    const r = ScoreParamSchema.safeParse(4);
    expect(r.success).toBe(false);
  });

  it('SearchParamsSchema: query + limit + offset passam', () => {
    const r = SearchParamsSchema.safeParse({ q: 'npm install', limit: 10, offset: 0 });
    expect(r.success).toBe(true);
  });
});
