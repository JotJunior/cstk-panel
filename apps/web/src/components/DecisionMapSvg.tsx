/**
 * DecisionMapSvg — SVG do mapa de decisões.
 *
 * Renderiza nós via <foreignObject> + DecisionMapNode, arestas direcionadas
 * com marker-end, e rótulos de onda acima de cada coluna.
 *
 * NUNCA usa innerHTML ou dangerouslySetInnerHTML (data-model §Invariantes).
 * Todos os campos textuais são UNTRUSTED — delegados ao DecisionMapNode/TextRaw.
 *
 * Ref: tasks 2.2.1–2.2.10; spec §FR-002, FR-005, FR-010;
 *      plan §DecisionMapSvg; data-model §Invariantes
 */

import React, { useCallback, useRef } from 'react';
import type { MapNode, MapEdge } from '@/lib/decision-map-layout.js';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  HEADER_Y,
  PADDING,
  waveLabels,
} from '@/lib/decision-map-layout.js';
import { DecisionMapNode } from './DecisionMapNode.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DecisionMapSvgProps {
  nodes: MapNode[];
  edges: MapEdge[];
  svgWidth: number;
  svgHeight: number;
  selectedKey: string | null;
  onNodeSelect: (key: string) => void;
  /** Ref para devolver foco ao nó ao fechar painel (dec-016 / CHK022) */
  nodeRefs?: React.MutableRefObject<Map<string, SVGGElement>>;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DecisionMapSvg({
  nodes,
  edges,
  svgWidth,
  svgHeight,
  selectedKey,
  onNodeSelect,
  nodeRefs,
}: DecisionMapSvgProps) {
  // Map interno de refs de cada <g> de nó (para foco por teclado)
  const internalRefs = useRef<Map<string, SVGGElement>>(new Map());
  const refs = nodeRefs ?? internalRefs;

  const setNodeRef = useCallback(
    (key: string) => (el: SVGGElement | null) => {
      if (el) {
        refs.current.set(key, el);
      } else {
        refs.current.delete(key);
      }
    },
    [refs]
  );

  // Rótulos de onda para cada coluna
  const labels = waveLabels(nodes);

  // Manipulador de teclado por nó (Enter/Espaço + Arrow keys)
  const handleKeyDown = useCallback(
    (key: string, nodeIndex: number) => (e: React.KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNodeSelect(key);
      }
      // Arrow keys — navegação entre nós (dec-014 / CHK017)
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextNode = nodes[nodeIndex + 1];
        if (nextNode) {
          const el = refs.current.get(nextNode.key);
          el?.focus();
        }
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevNode = nodes[nodeIndex - 1];
        if (prevNode) {
          const el = refs.current.get(prevNode.key);
          el?.focus();
        }
      }
    },
    [nodes, onNodeSelect, refs]
  );

  return (
    // 2.2.9: wrapper com scroll interno (dec-018 / CHK006, CHK007)
    <div
      style={{
        maxHeight: '60vh',
        overflow: 'auto',
        borderRadius: 8,
        border: '1px solid var(--border-1, #1e293b)',
        background: 'var(--bg-0, #020617)',
      }}
    >
      {/* 2.2.8: role="img" + aria-label no <svg> */}
      <svg
        width={svgWidth}
        height={svgHeight}
        role="img"
        aria-label="Mapa de decisões"
        style={{ display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 2.2.2: <defs> com marker de seta para arestas */}
        <defs>
          <marker
            id="decision-map-arrow"
            viewBox="0 0 10 10"
            refX={10}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill="var(--border-2, #374151)"
            />
          </marker>
        </defs>

        {/* 2.2.3: Rótulos de onda acima de cada coluna */}
        {labels.map(({ wave, x }) => (
          <text
            key={`wave-label-${wave}`}
            x={x + NODE_WIDTH / 2}
            y={PADDING + HEADER_Y - 6}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-3, #64748b)"
            fontFamily="var(--font-mono, monospace)"
          >
            {wave}
          </text>
        ))}

        {/* 2.2.4: Arestas renderizadas ANTES dos nós (z-order) */}
        {edges.map((edge) => {
          const fromNode = nodes.find(n => n.key === edge.from);
          const toNode = nodes.find(n => n.key === edge.to);
          if (!fromNode || !toNode) return null;

          // Centro inferior do nó de origem → centro superior do nó de destino
          const x1 = fromNode.x + NODE_WIDTH / 2;
          const y1 = fromNode.y + NODE_HEIGHT;
          const x2 = toNode.x + NODE_WIDTH / 2;
          const y2 = toNode.y;

          // Curva cúbica para transição entre colunas; linha reta para mesma coluna
          const isSameCol = fromNode.waveIndex === toNode.waveIndex;

          let d: string;
          if (isSameCol) {
            d = `M ${x1} ${y1} L ${x2} ${y2}`;
          } else {
            // Curva de Bezier entre colunas
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
          }

          return (
            <path
              key={`edge-${edge.from}-${edge.to}`}
              d={d}
              stroke="var(--border-2, #374151)"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#decision-map-arrow)"
            />
          );
        })}

        {/* 2.2.5: Nós via <g> + <foreignObject> + DecisionMapNode */}
        {nodes.map((node, idx) => (
          <g
            key={node.key}
            ref={setNodeRef(node.key)}
            transform={`translate(${node.x}, ${node.y})`}
            // 2.2.6: tabIndex, role, aria-label (dec-017 / CHK034 para null)
            tabIndex={0}
            role="button"
            aria-label={node.decision.escolha ?? 'decisão sem escolha'}
            aria-pressed={node.key === selectedKey}
            onClick={() => onNodeSelect(node.key)}
            // 2.2.7: Enter/Espaço + Arrow keys (dec-014)
            onKeyDown={handleKeyDown(node.key, idx)}
            style={{ outline: 'none', cursor: 'pointer' }}
          >
            {/* Ring de foco visível via CSS (2.1.7) */}
            <rect
              x={0}
              y={0}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={6}
              ry={6}
              fill="transparent"
              stroke="transparent"
              className="decision-map-focus-ring"
              style={{
                // O foco visível é aplicado via :focus-visible no CSS global
                // ou via outline no <g> — SVG não suporta :focus-visible nativo,
                // então usamos o rect como target visual
              }}
            />
            {/* 2.2.5 / 2.2.10: foreignObject para React component — zero innerHTML */}
            <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT} x={0} y={0}>
              <div style={{ height: '100%' }}>
                <DecisionMapNode
                  decision={node.decision}
                  selected={node.key === selectedKey}
                />
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
    </div>
  );
}
