/**
 * 7.4 Testes de paridade de tipos — shared-types ↔ payload real da API.
 * Ref: plan.md §Convencoes de Borda; quickstart.md §Cenario 1
 * Tasks 7.4.1 – 7.4.4
 *
 * Para cada DTO, fixtures de payload real (copiadas diretamente de
 * respostas reais da API) sao parseadas com safeParse(...).
 *
 * 7.4.2: TaskDTO — arquivosTocadosCount e number (nao array), lintOk e boolean
 * 7.4.3: WaveDTO — etapas e string (nao array)
 * 7.4.4: Teste de regressao — modificar campo para snake_case → safeParse falha
 *
 * Estes fixtures foram copiados de respostas reais da API (fixture DB real).
 * Ref: execucao 'exec-20260506T125546Z' da fixture knowledge-fixture.db.
 */
import { describe, it, expect } from 'vitest';
import {
  ExecutionDTOSchema,
  WaveDTOSchema,
  TaskDTOSchema,
  FtsHitDTOSchema,
  DecisionDTOSchema,
  AlertSignalDTOSchema,
} from '../schemas/entities.js';
import { RawApiEnvelopeSchema } from '../schemas/envelope.js';

// ─── Fixtures reais (shape capturado da API) ───────────────────────────────────
// Todos os campos em camelCase (convencao de borda: snake_case DB → camelCase DTO)

const ISO = '2026-05-06T12:57:32Z';

// ExecutionDTO real (shape da rota GET /executions/:id)
const REAL_EXECUTION_PAYLOAD = {
  project: 'cad-poc',
  feature: 'unknown',
  execucaoId: 'exec-20260506T125546Z',
  status: 'concluida' as const,
  motivoTermino: 'concluido',
  etapaCorrente: 'review-task',
  iniciadaEm: ISO,
  terminadaEm: '2026-05-06T20:00:00Z',
  duracaoSegundos: 25900,
  stackSugerida: null,
  ondasTotal: 10,
  toolCallsTotal: 320,
  wallclockTotalSegundos: 9600,
  subagentesSpawned: null,
  profundidadeMax: null,
  decisoesTotal: 42,
  bloqueiosHumanosTotal: null,
  sugestoesSkillsTotal: null,
  issuesToolkitAbertas: null,
};

// WaveDTO real (shape da rota GET /executions/:id/waves)
// CRITICO: etapas e string, NAO array (convencao borda v2)
const REAL_WAVE_PAYLOAD = {
  wave: 'onda-001',
  execucaoId: 'exec-20260506T125546Z',
  etapas: 'execute-task',     // string unica — NAO array
  inicio: ISO,
  fim: '2026-05-06T13:16:15Z',
  wallclockSeconds: 1123,
  toolCalls: 0,
  motivoTermino: 'etapa_concluida_avancando',
  nEtapas: 0,
  nSkills: 0,
};

// TaskDTO real (shape da rota GET /executions/:id/tasks)
// CRITICO: arquivosTocadosCount e number, lintOk e boolean
const REAL_TASK_PAYLOAD = {
  wave: 'onda-005',
  execucaoId: 'exec-20260506T125546Z',
  titulo: 'Implementar ingestão de métricas',  // schema v3
  outcome: 'pass' as const,
  testesRodados: 12,
  testesPassados: 12,
  lintOk: true,               // boolean (nao 0/1)
  arquivosTocadosCount: 5,    // number (nao array de paths)
};

// DecisionDTO real (shape da rota GET /executions/:id/decisions)
const REAL_DECISION_PAYLOAD = {
  wave: 'onda-003',
  execucaoId: 'exec-20260506T125546Z',
  etapa: 'execute-task',
  agente: 'agente-00c-orchestrator',
  escolha: 'manter-tipo',
  score: 2 as const,
  contexto: 'Tipo incompativel em src/foo.ts',
  justificativa: 'tsc indica TS2322',
  evidencia: 'npx tsc --noEmit: src/foo.ts:12 error TS2322',
};

// FtsHitDTO real (shape da rota GET /search)
const REAL_FTS_HIT_PAYLOAD = {
  body: 'execute-task executar a tarefa 4.1 conforme o plano',
  type: 'decision',
  project: 'cad-poc',
  feature: 'unknown',
  wave: 'onda-007',
  sourceId: 'dec-001',
  sourceTs: ISO,
  rank: -1.234,
};

// AlertSignalDTO real
const REAL_ALERT_SIGNAL_PAYLOAD = {
  execucaoId: 'exec-20260506T125546Z',
  tipo: 'budget_breach' as const,
  subtipo: 'tool_calls',
  valorConsumido: 320,
  valorThreshold: 300,
  descricao: 'tool_calls excedeu threshold',
  wave: 'onda-009',
};

// Envelope real (wrapper em torno de qualquer data)
const REAL_ENVELOPE_PAYLOAD = {
  data: { totalExecutions: 14 },
  meta: {
    degraded: false,
    reason: null,
    freshness: {
      mtime: '2026-05-24T10:47:02.000Z',
      maxIngestedAt: '2026-05-24T10:47:02Z',
    },
    schemaVersion: '2',
  },
};

// ─── 7.4.1 Parse de cada DTO com fixture real ─────────────────────────────────

describe('7.4.1 Paridade shared-types ↔ payload real', () => {
  it('ExecutionDTOSchema.safeParse(payload_real) === true', () => {
    const r = ExecutionDTOSchema.safeParse(REAL_EXECUTION_PAYLOAD);
    expect(r.success, `falhou: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
  });

  it('WaveDTOSchema.safeParse(payload_real) === true', () => {
    const r = WaveDTOSchema.safeParse(REAL_WAVE_PAYLOAD);
    expect(r.success, `falhou: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
  });

  it('TaskDTOSchema.safeParse(payload_real) === true', () => {
    const r = TaskDTOSchema.safeParse(REAL_TASK_PAYLOAD);
    expect(r.success, `falhou: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
  });

  it('DecisionDTOSchema.safeParse(payload_real) === true', () => {
    const r = DecisionDTOSchema.safeParse(REAL_DECISION_PAYLOAD);
    expect(r.success, `falhou: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
  });

  it('FtsHitDTOSchema.safeParse(payload_real) === true', () => {
    const r = FtsHitDTOSchema.safeParse(REAL_FTS_HIT_PAYLOAD);
    expect(r.success, `falhou: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
  });

  it('AlertSignalDTOSchema.safeParse(payload_real) === true', () => {
    const r = AlertSignalDTOSchema.safeParse(REAL_ALERT_SIGNAL_PAYLOAD);
    expect(r.success, `falhou: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
  });

  it('RawApiEnvelopeSchema.safeParse(envelope_real) === true', () => {
    const r = RawApiEnvelopeSchema.safeParse(REAL_ENVELOPE_PAYLOAD);
    expect(r.success, `falhou: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`).toBe(true);
  });
});

// ─── 7.4.2 TaskDTO: arquivosTocadosCount e number, lintOk e boolean ──────────

describe('7.4.2 TaskDTO — campos criticos', () => {
  it('arquivosTocadosCount e number (nao array)', () => {
    const r = TaskDTOSchema.safeParse(REAL_TASK_PAYLOAD);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(typeof r.data.arquivosTocadosCount).toBe('number');
      expect(Array.isArray(r.data.arquivosTocadosCount)).toBe(false);
    }
  });

  it('lintOk e boolean (nao 0 nem 1)', () => {
    const r = TaskDTOSchema.safeParse(REAL_TASK_PAYLOAD);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(typeof r.data.lintOk).toBe('boolean');
    }
  });

  it('lintOk=false tambem passa (nao apenas true)', () => {
    const payload = { ...REAL_TASK_PAYLOAD, lintOk: false };
    const r = TaskDTOSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });

  it('TaskDTO rejeita arquivosTocadosCount como array (schema nao aceita)', () => {
    const badPayload = { ...REAL_TASK_PAYLOAD, arquivosTocadosCount: ['src/foo.ts', 'src/bar.ts'] };
    const r = TaskDTOSchema.safeParse(badPayload);
    expect(r.success).toBe(false);
  });

  it('TaskDTO rejeita lintOk como inteiro 0/1 (boolean obrigatorio)', () => {
    const badPayload = { ...REAL_TASK_PAYLOAD, lintOk: 1 };
    const r = TaskDTOSchema.safeParse(badPayload);
    expect(r.success).toBe(false);
  });
});

// ─── 7.4.3 WaveDTO: etapas e string, NAO array ───────────────────────────────

describe('7.4.3 WaveDTO — etapas e string (nao array)', () => {
  it('etapas como string passa', () => {
    const r = WaveDTOSchema.safeParse(REAL_WAVE_PAYLOAD);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(typeof r.data.etapas).toBe('string');
    }
  });

  it('etapas como array FALHA (nao e array em schema v2)', () => {
    const badPayload = { ...REAL_WAVE_PAYLOAD, etapas: ['execute-task', 'review-task'] };
    const r = WaveDTOSchema.safeParse(badPayload);
    expect(r.success).toBe(false);
  });

  it('etapas como string vazia passa (onda sem etapas registradas)', () => {
    const emptyPayload = { ...REAL_WAVE_PAYLOAD, etapas: '' };
    const r = WaveDTOSchema.safeParse(emptyPayload);
    expect(r.success).toBe(true);
  });
});

// ─── 7.4.4 Teste de regressao: snake_case → safeParse falha ──────────────────

describe('7.4.4 Regressao — snake_case causa falha em safeParse (teste nao e trivial)', () => {
  it('ExecutionDTOSchema rejeita execucao_id (snake_case) — deve ser execucaoId', () => {
    const snakeCasePayload = {
      project: 'cad-poc',
      feature: 'unknown',
      execucao_id: 'exec-001',    // snake_case — schema espera execucaoId
      status: 'concluida',
      motivo_termino: null,       // snake_case — schema espera motivoTermino
      etapa_corrente: null,
      iniciada_em: null,
      terminada_em: null,
      duracao_segundos: null,
      stack_sugerida: null,
      ondas_total: null,
      tool_calls_total: null,
      wallclock_total_segundos: null,
      subagentes_spawned: null,
      profundidade_max: null,
      decisoes_total: null,
      bloqueios_humanos_total: null,
      sugestoes_skills_total: null,
      issues_toolkit_abertas: null,
    };
    const r = ExecutionDTOSchema.safeParse(snakeCasePayload);
    // Schema exige execucaoId (camelCase) — snake_case deve falhar
    expect(r.success).toBe(false);
  });

  it('WaveDTOSchema rejeita tool_calls (snake_case) — deve ser toolCalls', () => {
    const snakeWave = {
      wave: 'onda-001',
      execucao_id: 'exec-001',   // snake_case
      etapas: 'execute-task',
      inicio: ISO,
      fim: null,
      wallclock_seconds: 1123,  // snake_case
      tool_calls: 0,             // snake_case
      motivo_termino: null,
      n_etapas: 0,
      n_skills: 0,
    };
    const r = WaveDTOSchema.safeParse(snakeWave);
    // snake_case deve falhar — schema exige execucaoId, wallclockSeconds, toolCalls
    expect(r.success).toBe(false);
  });

  it('FtsHitDTOSchema rejeita source_id (snake_case) — deve ser sourceId', () => {
    const snakeHit = {
      body: 'texto',
      type: 'decision',
      project: 'proj',
      feature: 'feat',
      wave: 'onda-001',
      source_id: 'dec-001',  // snake_case — deve ser sourceId
      source_ts: ISO,        // snake_case — deve ser sourceTs
      rank: -1.0,
    };
    const r = FtsHitDTOSchema.safeParse(snakeHit);
    // sourceId e sourceTs obrigatorios — snake_case deve falhar
    expect(r.success).toBe(false);
  });

  it('TaskDTOSchema rejeita arquivos_tocados_count (snake_case) — deve ser arquivosTocadosCount', () => {
    const snakeTask = {
      wave: 'onda-005',
      execucao_id: 'exec-001',       // snake_case
      outcome: 'pass',
      testes_rodados: 12,            // snake_case
      testes_passados: 12,           // snake_case
      lint_ok: true,                 // snake_case
      arquivos_tocados_count: 5,     // snake_case
    };
    const r = TaskDTOSchema.safeParse(snakeTask);
    // arquivosTocadosCount obrigatorio — snake_case deve falhar
    expect(r.success).toBe(false);
  });
});

// ─── Validacao de enums (status, outcome, eventType, tipo) ───────────────────

describe('7.4 Enums — valores fora do enum rejeitados', () => {
  it('ExecutionDTOSchema rejeita status desconhecido', () => {
    const r = ExecutionDTOSchema.safeParse({ ...REAL_EXECUTION_PAYLOAD, status: 'pausada' });
    expect(r.success).toBe(false);
  });

  it('TaskDTOSchema rejeita outcome desconhecido', () => {
    const r = TaskDTOSchema.safeParse({ ...REAL_TASK_PAYLOAD, outcome: 'skip' });
    expect(r.success).toBe(false);
  });

  it('AlertSignalDTOSchema rejeita tipo desconhecido', () => {
    const r = AlertSignalDTOSchema.safeParse({ ...REAL_ALERT_SIGNAL_PAYLOAD, tipo: 'warning' });
    expect(r.success).toBe(false);
  });
});
