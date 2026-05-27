/**
 * Testes da classificacao de etapas do pipeline (stageStates).
 *
 * Regressao: execucoes terminais gravam etapa_corrente='concluida' (marcador
 * FORA de SDD_STAGES → idx=-1). A logica antiga do modo rotulado acendia por
 * `i < idx`, entao idx=-1 deixava TODAS as barras cinzas na visao da execucao.
 * A decisao agora acende pelo STATUS, identico nos dois modos de render.
 */
import { describe, it, expect } from 'vitest';
import { SDD_STAGES } from '@/lib/constants.js';
import { stageStates } from './PipelineProgress.js';

const N = SDD_STAGES.length; // 9

describe('stageStates', () => {
  it('concluida acende TODAS as etapas (done), independente da etapa', () => {
    // etapa='concluida' nao esta em SDD_STAGES → idx=-1: o caso que apagava tudo
    expect(stageStates('concluida', 'concluida')).toEqual(Array(N).fill('done'));
    // mesmo sem etapa informada
    expect(stageStates(null, 'concluida')).toEqual(Array(N).fill('done'));
  });

  it('em_andamento: etapas anteriores done, a corrente current, futuras idle', () => {
    // 'plan' e o indice 4
    const states = stageStates('plan', 'em_andamento');
    expect(states).toEqual([
      'done', 'done', 'done', 'done', 'current', 'idle', 'idle', 'idle', 'idle',
    ]);
  });

  it('aguardando_humano comporta-se como em andamento (corrente = current)', () => {
    const states = stageStates('specify', 'aguardando_humano'); // idx=2
    expect(states[1]).toBe('done');
    expect(states[2]).toBe('current');
    expect(states[3]).toBe('idle');
  });

  it('abortada: anteriores done, a partir da corrente aborted', () => {
    const states = stageStates('clarify', 'abortada'); // idx=3
    expect(states).toEqual([
      'done', 'done', 'done', 'aborted', 'aborted', 'aborted', 'aborted', 'aborted', 'aborted',
    ]);
  });

  it('abortada sem etapa (idx=-1) marca tudo como aborted', () => {
    expect(stageStates('abortada', 'abortada')).toEqual(Array(N).fill('aborted'));
  });

  it('status null: primeira etapa idle (nada alcancado)', () => {
    expect(stageStates(null, null)).toEqual(Array(N).fill('idle'));
  });
});
