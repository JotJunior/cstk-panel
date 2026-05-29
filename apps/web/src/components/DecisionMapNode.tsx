/**
 * DecisionMapNode — nó individual do Decision Map Panel.
 *
 * Renderizado dentro de um <foreignObject> no SVG.
 * NUNCA usa innerHTML ou dangerouslySetInnerHTML (spec §FR-007).
 * Todos os campos textuais são UNTRUSTED — renderizados via <TextRaw>.
 *
 * Ref: tasks 2.1.1–2.1.8; spec §FR-003, FR-004, FR-007;
 *      plan §DecisionMapNode; data-model §Entity MapNode
 */

import React from 'react';
import type { DecisionDTO } from '@cstk-panel/shared-types';
import { TextRaw } from './TextRaw.js';
import { ScoreChip } from './ScoreChip.js';

interface DecisionMapNodeProps {
  decision: DecisionDTO;
  /** Nó está selecionado (clique ou teclado). */
  selected?: boolean;
}

export function DecisionMapNode({ decision, selected = false }: DecisionMapNodeProps) {
  // 2.1.5: fallback para escolha = null — TextRaw já renderiza "-" para null,
  // mas exibimos estilo levemente diferente para deixar claro que não há escolha.
  const hasEscolha = decision.escolha != null && decision.escolha !== '';

  return (
    <div
      className={`decision-map-node${selected ? ' selected' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '6px 8px',
        borderRadius: 6,
        border: selected
          ? '2px solid var(--accent, #3b82f6)'
          : '1px solid var(--border-2, #374151)',
        background: selected
          ? 'var(--bg-2, #1e293b)'
          : 'var(--bg-1, #0f172a)',
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.25)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        // Tema claro: tokens CSS sobrescrevem automaticamente (CHK060)
        transition: 'border-color 0.1s, box-shadow 0.1s',
      }}
    >
      {/* Escolha — campo UNTRUSTED, máx 40 chars */}
      {/* 2.1.2 / 2.1.5 */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.3,
          color: hasEscolha
            ? 'var(--text-1, #f1f5f9)'
            : 'var(--text-3, #64748b)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: '1 1 auto',
        }}
      >
        <TextRaw value={decision.escolha} maxLength={40} />
      </span>

      {/* Linha inferior: onda (mono) + score */}
      {/* 2.1.3 / 2.1.4 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          flexShrink: 0,
        }}
      >
        {/* Rótulo da onda em monospace (text-3) — 2.1.4 */}
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 10,
            color: 'var(--text-3, #64748b)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {decision.wave}
        </span>

        {/* Score com cor semântica — 2.1.3 */}
        <ScoreChip score={decision.score} />
      </div>
    </div>
  );
}
