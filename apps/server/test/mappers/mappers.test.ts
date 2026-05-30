/**
 * Testes unitarios dos mappers — task 3.4.6.
 * Garante: lint_ok=0→false, lint_ok=1→true; stages permanece string;
 * score=2→2; campos UNTRUSTED nao transformados.
 *
 * Tambem task 3.4.7: parse Zod sobre saida de cada mapper (.success===true).
 *
 * FASE 3 (new-schema): Row fixtures migradas pt-BR→EN snake_case (task 3.4.6).
 */
import { describe, it, expect } from 'vitest';
import {
  ExecutionDTOSchema,
  WaveDTOSchema,
  DecisionDTOSchema,
  TaskDTOSchema,
  EventDTOSchema,
  AlertSignalDTOSchema,
  BlockDTOSchema,
  SkillDTOSchema,
} from '@cstk-panel/shared-types';
import { mapExecution } from '../../src/mappers/execution.js';
import { mapWave } from '../../src/mappers/wave.js';
import { mapDecision } from '../../src/mappers/decision.js';
import { mapTask } from '../../src/mappers/task.js';
import { mapEvent } from '../../src/mappers/event.js';
import { mapAlert } from '../../src/mappers/alert.js';
import { mapBlock } from '../../src/mappers/block.js';
import { mapSkill } from '../../src/mappers/skill.js';

const ISO = '2025-01-15T10:00:00.000Z';

describe('mapTask', () => {
  it('lint_ok=1 → lintOk=true', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', title: '', outcome: 'pass',
      tests_run: 3, tests_passed: 3, lint_ok: 1, touched_files: 5,
    };
    const dto = mapTask(row);
    expect(dto.lintOk).toBe(true);
    expect(typeof dto.lintOk).toBe('boolean');
  });

  it('lint_ok=0 → lintOk=false', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', title: '', outcome: 'fail',
      tests_run: 0, tests_passed: 0, lint_ok: 0, touched_files: 2,
    };
    const dto = mapTask(row);
    expect(dto.lintOk).toBe(false);
    expect(typeof dto.lintOk).toBe('boolean');
  });

  it('lint_ok=null → lintOk=null', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', title: '', outcome: null,
      tests_run: null, tests_passed: null, lint_ok: null, touched_files: null,
    };
    const dto = mapTask(row);
    expect(dto.lintOk).toBeNull();
  });

  it('touched_files=5 → touchedFilesCount=5 (number, nao array)', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', title: '', outcome: 'pass',
      tests_run: 1, tests_passed: 1, lint_ok: 1, touched_files: 5,
    };
    const dto = mapTask(row);
    expect(typeof dto.touchedFilesCount).toBe('number');
    expect(dto.touchedFilesCount).toBe(5);
    expect(Array.isArray(dto.touchedFilesCount)).toBe(false);
  });

  it('title (v7 EN) presente → mapeado verbatim', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', title: 'Implementar login', outcome: 'pass',
      tests_run: 3, tests_passed: 3, lint_ok: 1, touched_files: 5,
    };
    const dto = mapTask(row);
    expect(dto.title).toBe('Implementar login');
  });

  it('title ausente (base v2) → "" (retro-compat, FR-V3-004)', () => {
    // Row de uma base v2 sem a coluna title (a query projeta '' mas validamos
    // a defesa do mapper tambem).
    const row = {
      wave: 'onda-001', execution_id: 'e1', outcome: 'pass',
      tests_run: 1, tests_passed: 1, lint_ok: 1, touched_files: 0,
    } as unknown as Parameters<typeof mapTask>[0];
    const dto = mapTask(row);
    expect(dto.title).toBe('');
  });

  it('paridade round-trip: TaskDTOSchema.safeParse(mapTask(row)).success===true', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', title: 'Task X', outcome: 'pass',
      tests_run: 3, tests_passed: 3, lint_ok: 1, touched_files: 5,
    };
    const dto = mapTask(row);
    const r = TaskDTOSchema.safeParse(dto);
    expect(r.success).toBe(true);
  });
});

describe('mapWave', () => {
  it('stages permanece string (nao converte para array)', () => {
    const row = {
      wave: 'onda-007', execution_id: 'e1', stages: 'execute-task',
      started_at: ISO, finished_at: null, wallclock_seconds: 120, tool_calls: 25,
      termination_reason: null, n_stages: 1, n_skills: 3,
    };
    const dto = mapWave(row);
    expect(typeof dto.stages).toBe('string');
    expect(Array.isArray(dto.stages)).toBe(false);
    expect(dto.stages).toBe('execute-task');
  });

  it('paridade round-trip: WaveDTOSchema.safeParse(mapWave(row)).success===true', () => {
    const row = {
      wave: 'onda-007', execution_id: 'e1', stages: 'execute-task',
      started_at: ISO, finished_at: null, wallclock_seconds: 120, tool_calls: 25,
      termination_reason: null, n_stages: 1, n_skills: 3,
    };
    const r = WaveDTOSchema.safeParse(mapWave(row));
    expect(r.success).toBe(true);
  });
});

describe('mapDecision', () => {
  it('score=2 → 2 (tipo correto)', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', stage: 'execute-task',
      agent: 'orquestrador', choice: 'ok', options: null, score: 2,
      context: 'ctx UNTRUSTED', rationale: 'just', evidence: null,
    };
    const dto = mapDecision(row);
    expect(dto.score).toBe(2);
  });

  it('options JSON cru preservado sem transformacao (schema v6/v7)', () => {
    const OPTIONS = '["haiku","sonnet","opus"]';
    const row = {
      wave: 'onda-001', execution_id: 'e1', stage: 'model-routing',
      agent: 'orquestrador', choice: 'model:sonnet', options: OPTIONS, score: 0,
      context: 'ctx', rationale: 'just', evidence: null,
    };
    // Mapper repassa o array JSON cru — FE deriva os chips
    expect(mapDecision(row).options).toBe(OPTIONS);
  });

  it('options ausente em base v<6 → null (FR-V3-005)', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', stage: 'execute-task',
      agent: 'orquestrador', choice: 'ok', options: null, score: 1,
      context: 'ctx', rationale: 'just', evidence: null,
    };
    expect(mapDecision(row).options).toBeNull();
  });

  it('campos UNTRUSTED preservados sem transformacao', () => {
    const HOSTIL = '<script>alert(1)</script>';
    const row = {
      wave: 'onda-001', execution_id: 'e1', stage: null, agent: null,
      choice: null, options: null, score: 0, context: HOSTIL, rationale: HOSTIL, evidence: null,
    };
    const dto = mapDecision(row);
    // Mapper NAO sanitiza — preserva cru para FE renderizar via textContent
    expect(dto.context).toBe(HOSTIL);
    expect(dto.rationale).toBe(HOSTIL);
  });

  it('paridade round-trip: DecisionDTOSchema', () => {
    const row = {
      wave: 'onda-001', execution_id: 'e1', stage: 'execute-task',
      agent: 'agente', choice: 'ok', options: '["ok","cancelar"]', score: 3,
      context: 'ctx', rationale: 'just', evidence: 'ev',
    };
    const r = DecisionDTOSchema.safeParse(mapDecision(row));
    expect(r.success).toBe(true);
  });
});

describe('mapExecution', () => {
  it('paridade round-trip: ExecutionDTOSchema', () => {
    const row = {
      project: 'cstk', feature: 'cstk-panel', execution_id: 'exec-001',
      status: 'em_andamento', termination_reason: null, current_stage: 'execute-task',
      started_at: ISO, finished_at: null, duration_seconds: null,
      suggested_stack: 'node+ts', waves_total: 7, tool_calls_total: 120,
      wallclock_total_seconds: 3600, subagents_spawned: 0, max_depth: 1,
      decisions_total: 38, human_blocks_total: 1, skill_suggestions_total: 0,
      toolkit_issues_opened: 0,
    };
    const r = ExecutionDTOSchema.safeParse(mapExecution(row));
    expect(r.success).toBe(true);
  });
});

describe('mapEvent', () => {
  it('paridade round-trip: EventDTOSchema', () => {
    const row = {
      execution_id: 'e1', event_type: 'schedule_wait',
      timestamp: ISO, description: null,
    };
    const r = EventDTOSchema.safeParse(mapEvent(row));
    expect(r.success).toBe(true);
  });

  it('recall_consulted (v3) NAO e reclassificado como schedule_wait (FR-V3-006)', () => {
    const row = {
      execution_id: 'e1', event_type: 'recall_consulted',
      timestamp: ISO, description: 'etapa=specify hits=3',
    };
    const dto = mapEvent(row);
    expect(dto.eventType).toBe('recall_consulted');
    expect(EventDTOSchema.safeParse(dto).success).toBe(true);
  });

  it('tipo desconhecido continua caindo no fallback schedule_wait', () => {
    const row = {
      execution_id: 'e1', event_type: 'tipo_inexistente',
      timestamp: ISO, description: null,
    };
    expect(mapEvent(row).eventType).toBe('schedule_wait');
  });
});

describe('mapAlert', () => {
  it('paridade round-trip: AlertSignalDTOSchema', () => {
    const row = {
      execution_id: 'e1', type: 'circular', subtype: null,
      consumed_value: null, threshold_value: null,
      description: 'ciclo detectado', wave: 'onda-001',
    };
    const r = AlertSignalDTOSchema.safeParse(mapAlert(row));
    expect(r.success).toBe(true);
  });
});

describe('mapBlock', () => {
  it('paridade round-trip: BlockDTOSchema', () => {
    const row = {
      execution_id: 'e1', status: 'respondido', question: 'Confirmar?',
      context_for_answer: null, answer: 'sim', decision_id: 'dec-001',
      triggered_at: ISO, answered_at: ISO, latency_seconds: 42,
    };
    const r = BlockDTOSchema.safeParse(mapBlock(row));
    expect(r.success).toBe(true);
  });
});

describe('mapSkill', () => {
  it('paridade round-trip: SkillDTOSchema', () => {
    const row = {
      execution_id: 'e1', skill_name: 'briefing', decision_id: 'dec-001', wave: 'onda-001',
    };
    const r = SkillDTOSchema.safeParse(mapSkill(row));
    expect(r.success).toBe(true);
  });
});
