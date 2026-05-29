/**
 * decision-map-layout.ts
 *
 * Engine de layout determinístico para o Decision Map Panel.
 * Converte DecisionDTO[] → MapLayout (nós com x/y + arestas).
 *
 * Zero dependências de React/DOM — módulo TypeScript puro.
 * Função pura: sem side effects, sem estado global.
 *
 * Ref: spec §FR-002, FR-005; plan §decision-map-layout.ts;
 *      data-model §Entity MapNode, §LayoutConfig
 */

import type { DecisionDTO } from '@cstk-panel/shared-types';

// ---------------------------------------------------------------------------
// Constantes de layout (data-model §Entity LayoutConfig)
// ---------------------------------------------------------------------------

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 72;
export const COL_GAP = 48;
export const ROW_GAP = 12;
export const HEADER_Y = 28;
export const PADDING = 16;

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------

/** Nó do mapa SVG derivado de um DecisionDTO. */
export interface MapNode {
  /** Chave sintética estável: `${wave}::${indexFlat}` */
  key: string;
  /** Referência ao DTO original (UNTRUSTED — renderizar via TextRaw) */
  decision: DecisionDTO;
  /** Posição x do canto superior esquerdo do nó (px) */
  x: number;
  /** Posição y do canto superior esquerdo do nó (px) */
  y: number;
  /** Índice da onda no array de ondas únicas (0-based) */
  waveIndex: number;
  /** Índice do nó dentro da onda (0-based) */
  nodeIndexInWave: number;
}

/** Aresta direcional entre dois nós consecutivos. */
export interface MapEdge {
  /** Chave do nó de origem */
  from: string;
  /** Chave do nó de destino */
  to: string;
}

/** Layout completo do mapa SVG. */
export interface MapLayout {
  nodes: MapNode[];
  edges: MapEdge[];
  /** Largura total do SVG (px) */
  svgWidth: number;
  /** Altura total do SVG (px) */
  svgHeight: number;
}

// ---------------------------------------------------------------------------
// Engine principal
// ---------------------------------------------------------------------------

/**
 * Calcula o layout determinístico do mapa de decisões.
 *
 * Algoritmo:
 * 1. Agrupa decisões por `wave` preservando a ordem do array flat.
 * 2. Cada onda ocupa uma coluna; nós da mesma onda são empilhados
 *    verticalmente (top→bottom), separados por ROW_GAP.
 * 3. A chave de cada nó é `${wave}::${indexFlat}` (posição 0-based no
 *    array flat recebido — estável dentro de uma request).
 * 4. Arestas conectam pares consecutivos no array flat (sem considerar
 *    troca de onda — a sequência é a ordem de inserção).
 * 5. svgWidth e svgHeight são calculados para encapsular todos os nós
 *    com PADDING nas 4 bordas.
 *
 * Caso base: `computeLayout([])` retorna layout vazio sem erro.
 * Caso limiar: 1 nó → 0 arestas.
 *
 * @param items Array de DecisionDTO na ordem retornada pela API (rowid ASC).
 *              A ordenação correta é premissa documentada em plan §Convencoes
 *              de Borda (CHK059): backend ordena por rowid ASC.
 */
export function computeLayout(items: DecisionDTO[]): MapLayout {
  if (items.length === 0) {
    return { nodes: [], edges: [], svgWidth: 0, svgHeight: 0 };
  }

  // 1. Mapear ondas únicas preservando ordem de aparição no array flat
  const waveOrder: string[] = [];
  const waveMap = new Map<string, number>(); // wave → waveIndex

  for (const item of items) {
    if (!waveMap.has(item.wave)) {
      waveMap.set(item.wave, waveOrder.length);
      waveOrder.push(item.wave);
    }
  }

  // 2. Calcular x de cada coluna de onda
  //    x(waveIndex) = PADDING + waveIndex * (NODE_WIDTH + COL_GAP)
  const colX = (wi: number): number => PADDING + wi * (NODE_WIDTH + COL_GAP);

  // 3. Rastrear quantos nós já foram inseridos em cada onda
  //    para calcular y de cada nó
  const waveNodeCount = new Map<string, number>();

  // 4. Construir nós
  const nodes: MapNode[] = items.map((decision, indexFlat) => {
    const wave = decision.wave;
    const waveIndex = waveMap.get(wave)!;
    const nodeIndexInWave = waveNodeCount.get(wave) ?? 0;
    waveNodeCount.set(wave, nodeIndexInWave + 1);

    const x = colX(waveIndex);
    const y = PADDING + HEADER_Y + nodeIndexInWave * (NODE_HEIGHT + ROW_GAP);
    const key = `${wave}::${indexFlat}`;

    return { key, decision, x, y, waveIndex, nodeIndexInWave };
  });

  // 5. Construir arestas — pares consecutivos no array flat
  const edges: MapEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const fromNode = nodes[i];
    const toNode = nodes[i + 1];
    if (fromNode && toNode) {
      edges.push({ from: fromNode.key, to: toNode.key });
    }
  }

  // 6. Calcular dimensões do SVG
  //    svgWidth: coluna mais à direita + NODE_WIDTH + PADDING
  const numWaves = waveOrder.length;
  const svgWidth = PADDING + numWaves * NODE_WIDTH + (numWaves - 1) * COL_GAP + PADDING;

  //    svgHeight: coluna com mais nós define a altura
  let maxNodesInColumn = 0;
  for (const count of waveNodeCount.values()) {
    if (count > maxNodesInColumn) maxNodesInColumn = count;
  }
  const svgHeight =
    PADDING + HEADER_Y + maxNodesInColumn * NODE_HEIGHT +
    (maxNodesInColumn - 1) * ROW_GAP + PADDING;

  return { nodes, edges, svgWidth, svgHeight };
}

// ---------------------------------------------------------------------------
// Helpers de navegação (usados pelo DecisionDetailPane)
// ---------------------------------------------------------------------------

/**
 * Retorna a chave do nó anterior no array flat, ou null se for o primeiro.
 */
export function prevKey(nodes: MapNode[], currentKey: string): string | null {
  const idx = nodes.findIndex(n => n.key === currentKey);
  if (idx <= 0) return null;
  return nodes[idx - 1]?.key ?? null;
}

/**
 * Retorna a chave do próximo nó no array flat, ou null se for o último.
 */
export function nextKey(nodes: MapNode[], currentKey: string): string | null {
  const idx = nodes.findIndex(n => n.key === currentKey);
  if (idx === -1 || idx === nodes.length - 1) return null;
  return nodes[idx + 1]?.key ?? null;
}

/**
 * Retorna as ondas únicas na ordem de aparição (para rótulos de coluna).
 */
export function waveLabels(nodes: MapNode[]): Array<{ wave: string; x: number; waveIndex: number }> {
  const seen = new Map<string, number>(); // wave → x
  for (const node of nodes) {
    if (!seen.has(node.decision.wave)) {
      seen.set(node.decision.wave, node.x);
    }
  }
  return Array.from(seen.entries()).map(([wave, x], waveIndex) => ({
    wave,
    x,
    waveIndex,
  }));
}
