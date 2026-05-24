/**
 * Testes unitarios dos mappers — task 3.4.6.
 * Garante: lint_ok=0→false, lint_ok=1→true; etapas permanece string;
 * score=2→2; campos UNTRUSTED nao transformados.
 *
 * Tambem task 3.4.7: parse Zod sobre saida de cada mapper (.success===true).
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
} from '@cstk-panel/shared-types';
import { mapExecution } from '../../src/mappers/execution.js';
import { mapWave } from '../../src/mappers/wave.js';
import { mapDecision } from '../../src/mappers/decision.js';
import { mapTask } from '../../src/mappers/task.js';
import { mapEvent } from '../../src/mappers/event.js';
import { mapAlert } from '../../src/mappers/alert.js';
import { mapBloqueio } from '../../src/mappers/bloqueio.js';
import { mapSkill } from '../../src/mappers/skill.js';

const ISO = '2025-01-15T10:00:00.000Z';

describe('mapTask', () => {
  it('lint_ok=1 → lintOk=true', () => {
    const row = {
      wave: 'onda-001', execucao_id: 'e1', outcome: 'pass',
      testes_rodados: 3, testes_passados: 3, lint_ok: 1, arquivos_tocados: 5,
    };
    const dto = mapTask(row);
    expect(dto.lintOk).toBe(true);
    expect(typeof dto.lintOk).toBe('boolean');
  });

  it('lint_ok=0 → lintOk=false', () => {
    const row = {
      wave: 'onda-001', execucao_id: 'e1', outcome: 'fail',
      testes_rodados: 0, testes_passados: 0, lint_ok: 0, arquivos_tocados: 2,
    };
    const dto = mapTask(row);
    expect(dto.lintOk).toBe(false);
    expect(typeof dto.lintOk).toBe('boolean');
  });

  it('lint_ok=null → lintOk=null', () => {
    const row = {
      wave: 'onda-001', execucao_id: 'e1', outcome: null,
      testes_rodados: null, testes_passados: null, lint_ok: null, arquivos_tocados: null,
    };
    const dto = mapTask(row);
    expect(dto.lintOk).toBeNull();
  });

  it('arquivos_tocados=5 → arquivosTocadosCount=5 (number, nao array)', () => {
    const row = {
      wave: 'onda-001', execucao_id: 'e1', outcome: 'pass',
      testes_rodados: 1, testes_passados: 1, lint_ok: 1, arquivos_tocados: 5,
    };
    const dto = mapTask(row);
    expect(typeof dto.arquivosTocadosCount).toBe('number');
    expect(dto.arquivosTocadosCount).toBe(5);
    expect(Array.isArray(dto.arquivosTocadosCount)).toBe(false);
  });

  it('paridade round-trip: TaskDTOSchema.safeParse(mapTask(row)).success===true', () => {
    const row = {
      wave: 'onda-001', execucao_id: 'e1', outcome: 'pass',
      testes_rodados: 3, testes_passados: 3, lint_ok: 1, arquivos_tocados: 5,
    };
    const dto = mapTask(row);
    const r = TaskDTOSchema.safeParse(dto);
    expect(r.success).toBe(true);
  });
});

describe('mapWave', () => {
  it('etapas permanece string (nao converte para array)', () => {
    const row = {
      wave: 'onda-007', execucao_id: 'e1', etapas: 'execute-task',
      inicio: ISO, fim: null, wallclock_seconds: 120, tool_calls: 25,
      motivo_termino: null, n_etapas: 1, n_skills: 3,
    };
    const dto = mapWave(row);
    expect(typeof dto.etapas).toBe('string');
    expect(Array.isArray(dto.etapas)).toBe(false);
    expect(dto.etapas).toBe('execute-task');
  });

  it('paridade round-trip: WaveDTOSchema.safeParse(mapWave(row)).success===true', () => {
    const row = {
      wave: 'onda-007', execucao_id: 'e1', etapas: 'execute-task',
      inicio: ISO, fim: null, wallclock_seconds: 120, tool_calls: 25,
      motivo_termino: null, n_etapas: 1, n_skills: 3,
    };
    const r = WaveDTOSchema.safeParse(mapWave(row));
    expect(r.success).toBe(true);
  });
});

describe('mapDecision', () => {
  it('score=2 → 2 (tipo correto)', () => {
    const row = {
      wave: 'onda-001', execucao_id: 'e1', etapa: 'execute-task',
      agente: 'orquestrador', escolha: 'ok', score: 2,
      contexto: 'ctx UNTRUSTED', justificativa: 'just', evidencia: null,
    };
    const dto = mapDecision(row);
    expect(dto.score).toBe(2);
  });

  it('campos UNTRUSTED preservados sem transformacao', () => {
    const HOSTIL = '<script>alert(1)</script>';
    const row = {
      wave: 'onda-001', execucao_id: 'e1', etapa: null, agente: null,
      escolha: null, score: 0, contexto: HOSTIL, justificativa: HOSTIL, evidencia: null,
    };
    const dto = mapDecision(row);
    // Mapper NAO sanitiza — preserva cru para FE renderizar via textContent
    expect(dto.contexto).toBe(HOSTIL);
    expect(dto.justificativa).toBe(HOSTIL);
  });

  it('paridade round-trip: DecisionDTOSchema', () => {
    const row = {
      wave: 'onda-001', execucao_id: 'e1', etapa: 'execute-task',
      agente: 'agente', escolha: 'ok', score: 3,
      contexto: 'ctx', justificativa: 'just', evidencia: 'ev',
    };
    const r = DecisionDTOSchema.safeParse(mapDecision(row));
    expect(r.success).toBe(true);
  });
});

describe('mapExecution', () => {
  it('paridade round-trip: ExecutionDTOSchema', () => {
    const row = {
      project: 'cstk', feature: 'cstk-panel', execucao_id: 'exec-001',
      status: 'em_andamento', motivo_termino: null, etapa_corrente: 'execute-task',
      iniciada_em: ISO, terminada_em: null, duracao_segundos: null,
      stack_sugerida: 'node+ts', ondas_total: 7, tool_calls_total: 120,
      wallclock_total_segundos: 3600, subagentes_spawned: 0, profundidade_max: 1,
      decisoes_total: 38, bloqueios_humanos_total: 1, sugestoes_skills_total: 0,
      issues_toolkit_abertas: 0,
    };
    const r = ExecutionDTOSchema.safeParse(mapExecution(row));
    expect(r.success).toBe(true);
  });
});

describe('mapEvent', () => {
  it('paridade round-trip: EventDTOSchema', () => {
    const row = {
      execucao_id: 'e1', event_type: 'schedule_wait',
      timestamp: ISO, descricao: null,
    };
    const r = EventDTOSchema.safeParse(mapEvent(row));
    expect(r.success).toBe(true);
  });
});

describe('mapAlert', () => {
  it('paridade round-trip: AlertSignalDTOSchema', () => {
    const row = {
      execucao_id: 'e1', tipo: 'circular', subtipo: null,
      valor_consumido: null, valor_threshold: null,
      descricao: 'ciclo detectado', wave: 'onda-001',
    };
    const r = AlertSignalDTOSchema.safeParse(mapAlert(row));
    expect(r.success).toBe(true);
  });
});

describe('mapBloqueio', () => {
  it('paridade round-trip: BloqueioDTOSchema', () => {
    const row = {
      execucao_id: 'e1', status: 'respondido', pergunta: 'Confirmar?',
      contexto_para_resposta: null, resposta: 'sim', decisao_id: 'dec-001',
      disparado_em: ISO, respondido_em: ISO, latencia_segundos: 42,
    };
    const r = BloqueioDTOSchema.safeParse(mapBloqueio(row));
    expect(r.success).toBe(true);
  });
});

describe('mapSkill', () => {
  it('paridade round-trip: SkillDTOSchema', () => {
    const row = {
      execucao_id: 'e1', skill_name: 'briefing', decisao_id: 'dec-001', wave: 'onda-001',
    };
    const r = SkillDTOSchema.safeParse(mapSkill(row));
    expect(r.success).toBe(true);
  });
});
