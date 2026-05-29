/**
 * Testes unitários do engine de layout do Decision Map Panel.
 *
 * Ref: tasks 1.2.1–1.2.8; spec §SC-002; plan §Fase 1
 * Execução: vitest run apps/web/src/lib/decision-map-layout.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  prevKey,
  nextKey,
  waveLabels,
  NODE_WIDTH,
  NODE_HEIGHT,
  COL_GAP,
  ROW_GAP,
  HEADER_Y,
  PADDING,
} from './decision-map-layout.js';
import type { DecisionDTO } from '@cstk-panel/shared-types';

// ---------------------------------------------------------------------------
// Helper: criar um DecisionDTO mínimo para testes
// ---------------------------------------------------------------------------

function mkDecision(wave: string, overrides: Partial<DecisionDTO> = {}): DecisionDTO {
  return {
    wave,
    execucaoId: 'exec-test',
    etapa: null,
    agente: null,
    escolha: `escolha-${wave}`,
    opcoes: null,
    score: null,
    contexto: null,
    justificativa: null,
    evidencia: null,
    ...overrides,
  };
}

function mkDecisions(wave: string, count: number): DecisionDTO[] {
  return Array.from({ length: count }, (_, i) =>
    mkDecision(wave, { escolha: `escolha-${wave}-${i}` })
  );
}

// ---------------------------------------------------------------------------
// Caso 1.2.2 — array vazio
// ---------------------------------------------------------------------------

describe('computeLayout — array vazio', () => {
  it('retorna svgWidth=0, svgHeight=0, nodes=[], edges=[]', () => {
    const layout = computeLayout([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.svgWidth).toBe(0);
    expect(layout.svgHeight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Caso 1.2.3 — 1 decisão (1 nó, 0 arestas)
// ---------------------------------------------------------------------------

describe('computeLayout — 1 decisão', () => {
  const items = [mkDecision('onda-001')];
  const layout = computeLayout(items);

  it('produz 1 nó e 0 arestas', () => {
    expect(layout.nodes).toHaveLength(1);
    expect(layout.edges).toHaveLength(0);
  });

  it('nó está na posição PADDING, HEADER_Y + PADDING', () => {
    const node = layout.nodes[0]!;
    expect(node.x).toBe(PADDING);
    expect(node.y).toBe(PADDING + HEADER_Y);
  });

  it('chave sintética é wave::0', () => {
    expect(layout.nodes[0]!.key).toBe('onda-001::0');
  });

  it('svgWidth e svgHeight positivos', () => {
    expect(layout.svgWidth).toBeGreaterThan(0);
    expect(layout.svgHeight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Caso 1.2.4 — 3 decisões, 1 onda → 3 nós mesma coluna, 2 arestas
// ---------------------------------------------------------------------------

describe('computeLayout — 3 decisões, 1 onda', () => {
  const items = mkDecisions('onda-001', 3);
  const layout = computeLayout(items);

  it('produz 3 nós e 2 arestas', () => {
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(2);
  });

  it('todos os nós na mesma coluna (mesmo x)', () => {
    const xs = layout.nodes.map(n => n.x);
    expect(new Set(xs).size).toBe(1);
    expect(xs[0]!).toBe(PADDING);
  });

  it('nós empilhados verticalmente com ROW_GAP', () => {
    const ys = layout.nodes.map(n => n.y);
    expect(ys[1]! - ys[0]!).toBe(NODE_HEIGHT + ROW_GAP);
    expect(ys[2]! - ys[1]!).toBe(NODE_HEIGHT + ROW_GAP);
  });

  it('arestas ligam nós consecutivos', () => {
    expect(layout.edges[0]!.from).toBe('onda-001::0');
    expect(layout.edges[0]!.to).toBe('onda-001::1');
    expect(layout.edges[1]!.from).toBe('onda-001::1');
    expect(layout.edges[1]!.to).toBe('onda-001::2');
  });
});

// ---------------------------------------------------------------------------
// Caso 1.2.5 — 4 decisões, 2 ondas (2+2) → 2 colunas
// ---------------------------------------------------------------------------

describe('computeLayout — 4 decisões, 2 ondas (2+2)', () => {
  const items = [
    ...mkDecisions('onda-001', 2),
    ...mkDecisions('onda-002', 2),
  ];
  const layout = computeLayout(items);

  it('produz 4 nós e 3 arestas', () => {
    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(3);
  });

  it('nós de onda-001 na coluna 0, onda-002 na coluna 1', () => {
    const col0x = PADDING;
    const col1x = PADDING + NODE_WIDTH + COL_GAP;

    const onda001Nodes = layout.nodes.filter(n => n.decision.wave === 'onda-001');
    const onda002Nodes = layout.nodes.filter(n => n.decision.wave === 'onda-002');

    expect(onda001Nodes.every(n => n.x === col0x)).toBe(true);
    expect(onda002Nodes.every(n => n.x === col1x)).toBe(true);
  });

  it('chaves wave::indexFlat corretas', () => {
    expect(layout.nodes[0]!.key).toBe('onda-001::0');
    expect(layout.nodes[1]!.key).toBe('onda-001::1');
    expect(layout.nodes[2]!.key).toBe('onda-002::2');
    expect(layout.nodes[3]!.key).toBe('onda-002::3');
  });

  it('waveIndex e nodeIndexInWave corretos', () => {
    expect(layout.nodes[0]!.waveIndex).toBe(0);
    expect(layout.nodes[0]!.nodeIndexInWave).toBe(0);
    expect(layout.nodes[1]!.waveIndex).toBe(0);
    expect(layout.nodes[1]!.nodeIndexInWave).toBe(1);
    expect(layout.nodes[2]!.waveIndex).toBe(1);
    expect(layout.nodes[2]!.nodeIndexInWave).toBe(0);
    expect(layout.nodes[3]!.waveIndex).toBe(1);
    expect(layout.nodes[3]!.nodeIndexInWave).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Caso 1.2.6 — 100 decisões, 10 ondas (10 nós por onda)
// ---------------------------------------------------------------------------

describe('computeLayout — 100 decisões, 10 ondas', () => {
  const items: DecisionDTO[] = [];
  for (let w = 1; w <= 10; w++) {
    const wave = `onda-${String(w).padStart(3, '0')}`;
    items.push(...mkDecisions(wave, 10));
  }
  const layout = computeLayout(items);

  it('nodes.length === 100', () => {
    expect(layout.nodes).toHaveLength(100);
  });

  it('edges.length === 99', () => {
    expect(layout.edges).toHaveLength(99);
  });

  it('10 ondas distintas (10 colunas)', () => {
    const waves = new Set(layout.nodes.map(n => n.decision.wave));
    expect(waves.size).toBe(10);
  });

  it('benchmark: computeLayout em < 10ms para 100 itens (SC-002)', () => {
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      computeLayout(items); // 10 repetições
    }
    const avg = (performance.now() - t0) / 10;
    expect(avg).toBeLessThan(10); // < 10ms por chamada
  });
});

// ---------------------------------------------------------------------------
// Caso 1.2.7 — nó com escolha = null
// ---------------------------------------------------------------------------

describe('computeLayout — nó com escolha = null', () => {
  const items = [
    mkDecision('onda-001', { escolha: null }),
    mkDecision('onda-001'),
  ];
  const layout = computeLayout(items);

  it('chave gerada sem erro', () => {
    expect(layout.nodes[0]!.key).toBe('onda-001::0');
  });

  it('decision referenciada corretamente', () => {
    expect(layout.nodes[0]!.decision.escolha).toBeNull();
    expect(layout.nodes[0]!.decision.wave).toBe('onda-001');
  });

  it('produz 2 nós, 1 aresta', () => {
    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Helpers: prevKey / nextKey
// ---------------------------------------------------------------------------

describe('prevKey / nextKey', () => {
  const items = mkDecisions('onda-001', 3);
  const { nodes } = computeLayout(items);

  it('prevKey do primeiro nó é null', () => {
    expect(prevKey(nodes, nodes[0]!.key)).toBeNull();
  });

  it('nextKey do último nó é null', () => {
    expect(nextKey(nodes, nodes[2]!.key)).toBeNull();
  });

  it('prevKey do nó 1 é nó 0', () => {
    expect(prevKey(nodes, nodes[1]!.key)).toBe(nodes[0]!.key);
  });

  it('nextKey do nó 1 é nó 2', () => {
    expect(nextKey(nodes, nodes[1]!.key)).toBe(nodes[2]!.key);
  });

  it('chave inexistente retorna null', () => {
    expect(prevKey(nodes, 'nao-existe::99')).toBeNull();
    expect(nextKey(nodes, 'nao-existe::99')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Helpers: waveLabels
// ---------------------------------------------------------------------------

describe('waveLabels', () => {
  it('retorna 2 entradas para 2 ondas', () => {
    const items = [
      ...mkDecisions('onda-001', 2),
      ...mkDecisions('onda-002', 2),
    ];
    const { nodes } = computeLayout(items);
    const labels = waveLabels(nodes);
    expect(labels).toHaveLength(2);
    expect(labels[0]!.wave).toBe('onda-001');
    expect(labels[1]!.wave).toBe('onda-002');
  });

  it('x da onda-002 é maior que x da onda-001', () => {
    const items = [
      ...mkDecisions('onda-001', 1),
      ...mkDecisions('onda-002', 1),
    ];
    const { nodes } = computeLayout(items);
    const labels = waveLabels(nodes);
    expect(labels[1]!.x).toBeGreaterThan(labels[0]!.x);
  });

  it('retorna array vazio para nodes vazio', () => {
    expect(waveLabels([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pureza da função (sem side effects)
// ---------------------------------------------------------------------------

describe('computeLayout — pureza', () => {
  it('não modifica o array de entrada', () => {
    const items = mkDecisions('onda-001', 3);
    const original = JSON.stringify(items);
    computeLayout(items);
    expect(JSON.stringify(items)).toBe(original);
  });

  it('chamadas sucessivas com mesmo input produzem mesmo output', () => {
    const items = mkDecisions('onda-001', 5);
    const l1 = computeLayout(items);
    const l2 = computeLayout(items);
    expect(JSON.stringify(l1)).toBe(JSON.stringify(l2));
  });
});
