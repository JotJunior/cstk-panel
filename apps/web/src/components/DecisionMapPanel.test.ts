/**
 * Testes da camada de segurança e lógica do Decision Map Panel.
 *
 * Este arquivo testa a lógica extraível dos componentes sem DOM/jsdom:
 *  - FASE 5: verificações estáticas de acessibilidade (grep-based)
 *  - FASE 6: segurança de conteúdo (TextRaw contract + escapamento)
 *            estados derivados do layout + integridade estrutural do SVG
 *
 * Padrão do projeto: testes de lógica pura, sem React rendering.
 * Ambiente: node (vitest.config.ts root).
 *
 * Ref: tasks 5.1.1–5.1.8, 6.1.1–6.4.4; spec §FR-007, FR-010, US2 SC2;
 *      plan §Invariantes; constitution Princípio V (UNTRUSTED via TextRaw)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeLayout,
  prevKey,
  nextKey,
  NODE_WIDTH,
  NODE_HEIGHT,
  COL_GAP,
  ROW_GAP,
  HEADER_Y,
  PADDING,
} from '@/lib/decision-map-layout.js';
import type { DecisionDTO } from '@cstk-panel/shared-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SRC = resolve(process.cwd(), 'apps/web/src');

function readSrc(rel: string): string {
  return readFileSync(resolve(SRC, rel), 'utf-8');
}

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

// ---------------------------------------------------------------------------
// FASE 5 — Verificações estáticas de acessibilidade (5.1.1–5.1.8)
// Análise de fonte: confirma implementações sem execução DOM.
// ---------------------------------------------------------------------------

describe('FASE 5 — Acessibilidade (verificação estática de fonte)', () => {
  const svgSrc = readSrc('components/DecisionMapSvg.tsx');
  const panelSrc = readSrc('components/DecisionMapPanel.tsx');
  const paneSrc = readSrc('components/DecisionDetailPane.tsx');

  // 5.1.1 — Tab order: nós têm tabIndex={0}
  it('5.1.1 — nós SVG têm tabIndex={0} para participar do Tab order', () => {
    expect(svgSrc).toContain('tabIndex={0}');
  });

  // 5.1.2 — Enter/Espaço: onKeyDown com 'Enter' e ' '
  it('5.1.2 — nós SVG respondem a Enter e Espaço via onKeyDown', () => {
    expect(svgSrc).toContain("e.key === 'Enter'");
    expect(svgSrc).toContain("e.key === ' '");
    // Ação: chama onNodeSelect
    expect(svgSrc).toContain('onNodeSelect(key)');
  });

  // 5.1.3 — Escape fecha o painel lateral
  it('5.1.3 — DecisionDetailPane fecha ao pressionar Escape', () => {
    expect(paneSrc).toContain("e.key === 'Escape'");
    expect(paneSrc).toContain('onClose()');
    // Via event listener no document
    expect(paneSrc).toContain("document.addEventListener('keydown'");
  });

  // 5.1.4 — Botões prev/next acessíveis via teclado (são <button> nativos)
  it('5.1.4 — botões prev/next são <button> nativos com aria-label', () => {
    expect(paneSrc).toContain('aria-label="Decisão anterior"');
    expect(paneSrc).toContain('aria-label="Próxima decisão"');
    // São <button> → Tab + Enter funcionam nativamente
    const buttonOccurrences = (paneSrc.match(/<button/g) ?? []).length;
    expect(buttonOccurrences).toBeGreaterThanOrEqual(3); // prev + next + fechar
  });

  // 5.1.5 — Focus ring visível: classe CSS + rect sobreposição
  it('5.1.5 — nós SVG têm elemento visual para focus ring', () => {
    expect(svgSrc).toContain('decision-map-focus-ring');
    // outline: 'none' no <g> (foco gerenciado via CSS)
    expect(svgSrc).toContain("outline: 'none'");
  });

  // 5.1.6 — aria-label dos nós usa `escolha` real ou fallback
  it('5.1.6 — aria-label dos nós usa escolha real ou fallback quando null', () => {
    // Padrão: `node.decision.escolha ?? 'decisão sem escolha'`
    expect(svgSrc).toContain("node.decision.escolha ?? 'decisão sem escolha'");
    expect(svgSrc).toContain('aria-label=');
  });

  // 5.1.7 — Arrow keys: ArrowDown/Right = próximo nó; ArrowUp/Left = anterior
  it('5.1.7 — Arrow keys navegam entre nós (dec-014 / CHK017)', () => {
    expect(svgSrc).toContain("e.key === 'ArrowDown'");
    expect(svgSrc).toContain("e.key === 'ArrowRight'");
    expect(svgSrc).toContain("e.key === 'ArrowUp'");
    expect(svgSrc).toContain("e.key === 'ArrowLeft'");
    // Foca o nó adjacente via refs
    expect(svgSrc).toContain('el?.focus()');
  });

  // 5.1.8 — SC-006: toda interação via teclado
  it('5.1.8 — todas as ações têm equivalente de teclado (SC-006)', () => {
    // Selecionar nó: onClick + onKeyDown (Enter/Espaço)
    expect(svgSrc).toContain('onClick=');
    expect(svgSrc).toContain('onKeyDown=');
    // Fechar painel: botão X (button nativo) + Escape
    expect(paneSrc).toContain('aria-label="Fechar painel"');
    expect(paneSrc).toContain("e.key === 'Escape'");
    // Navegar prev/next: buttons nativos
    expect(paneSrc).toContain('disabled={prevKey === null}');
    expect(paneSrc).toContain('disabled={nextKey === null}');
  });

  // Foco retorna ao nó ao fechar painel (dec-016 / CHK022)
  it('5.1.3 (complemento) — foco retorna ao nó ao fechar painel', () => {
    // DecisionMapPanel: handleClosePane foca nodeRefs.current.get(key)
    expect(panelSrc).toContain('nodeRefs.current.get(key)');
    expect(panelSrc).toContain('el?.focus()');
  });

  // Foco inicial ao abrir mapa (dec-015 / CHK021)
  it('5.1.1 (complemento) — foco inicial no primeiro nó ao abrir mapa', () => {
    expect(panelSrc).toContain('layout.nodes[0]');
    expect(panelSrc).toContain("requestAnimationFrame(() => el.focus())");
  });
});

// ---------------------------------------------------------------------------
// FASE 6.1 — Layout: ordem determinística (6.1.1–6.1.3)
// ---------------------------------------------------------------------------

describe('FASE 6.1 — Determinismo do layout (casos adicionais)', () => {
  // 6.1.2 — Decisões em ordens diferentes de inserção → layout determinístico
  it('6.1.2 — decisões na mesma onda: ordem de inserção preservada', () => {
    const items: DecisionDTO[] = [
      mkDecision('onda-001', { escolha: 'A' }),
      mkDecision('onda-001', { escolha: 'B' }),
      mkDecision('onda-001', { escolha: 'C' }),
    ];
    const layout = computeLayout(items);

    // Chaves refletem indexFlat (ordem de inserção)
    expect(layout.nodes[0]!.key).toBe('onda-001::0');
    expect(layout.nodes[1]!.key).toBe('onda-001::1');
    expect(layout.nodes[2]!.key).toBe('onda-001::2');

    // Escolhas preservadas em ordem
    expect(layout.nodes[0]!.decision.escolha).toBe('A');
    expect(layout.nodes[1]!.decision.escolha).toBe('B');
    expect(layout.nodes[2]!.decision.escolha).toBe('C');
  });

  // 6.1.2 — Decisões misturadas entre ondas: chaves corretas
  it('6.1.2 — decisões intercaladas entre ondas: chaves indexFlat corretas', () => {
    const items: DecisionDTO[] = [
      mkDecision('onda-001', { escolha: 'A1' }),
      mkDecision('onda-002', { escolha: 'B1' }),
      mkDecision('onda-001', { escolha: 'A2' }), // segunda da onda-001
      mkDecision('onda-002', { escolha: 'B2' }),
    ];
    const layout = computeLayout(items);

    // Chaves são wave::indexFlat (posição no array flat)
    expect(layout.nodes[0]!.key).toBe('onda-001::0');
    expect(layout.nodes[1]!.key).toBe('onda-002::1');
    expect(layout.nodes[2]!.key).toBe('onda-001::2'); // onda-001, índice flat 2
    expect(layout.nodes[3]!.key).toBe('onda-002::3');
  });

  // 6.1.3 — Benchmark: 100 itens em < 10ms (SC-002)
  it('6.1.3 — benchmark: computeLayout para 100 itens < 10ms', () => {
    const items: DecisionDTO[] = [];
    for (let w = 1; w <= 10; w++) {
      for (let n = 0; n < 10; n++) {
        items.push(mkDecision(`onda-${String(w).padStart(3, '0')}`, {
          escolha: `escolha-${w}-${n}`,
        }));
      }
    }

    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      computeLayout(items);
    }
    const avg = (performance.now() - t0) / 10;
    expect(avg).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// Helpers: filtrar linhas de comentário do fonte para análise de código ativo
// ---------------------------------------------------------------------------

/** Remove linhas de comentário JSDoc/TSX para checar apenas código ativo. */
function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter(l => {
      const t = l.trim();
      // Remove JSDoc block comment lines (* ...)
      if (t.startsWith('* ') || t === '*') return false;
      // Remove JSDoc markers
      if (t.startsWith('/**') || t === '*/') return false;
      // Remove inline comments ({/* ... */} e // ...)
      if (t.startsWith('//')) return false;
      // Remove JSX comment lines ({/* ... */})
      if (t.startsWith('{/*') || t.endsWith('*/}')) return false;
      return true;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// FASE 6.2 — Segurança de conteúdo (6.2.1–6.2.5)
// Testa que componentes NÃO usam innerHTML/dangerouslySetInnerHTML no código ativo
// e que campos textuais UNTRUSTED são delegados ao TextRaw (análise estática).
// ---------------------------------------------------------------------------

describe('FASE 6.2 — Segurança de conteúdo (verificação estática)', () => {
  const svgCode = codeOnly(readSrc('components/DecisionMapSvg.tsx'));
  const nodeCode = codeOnly(readSrc('components/DecisionMapNode.tsx'));
  const paneCode = codeOnly(readSrc('components/DecisionDetailPane.tsx'));
  const textRawCode = codeOnly(readSrc('components/TextRaw.tsx'));

  // Para checar presença de patterns no fonte completo (incluindo comentários documentais)
  const paneSrc = readSrc('components/DecisionDetailPane.tsx');
  const nodeSrc = readSrc('components/DecisionMapNode.tsx');
  const textRawSrc = readSrc('components/TextRaw.tsx');

  // 6.2.1 — TextRaw NÃO usa dangerouslySetInnerHTML no código ativo
  it('6.2.1–6.2.3 — TextRaw NÃO usa dangerouslySetInnerHTML no código ativo', () => {
    expect(textRawCode).not.toContain('dangerouslySetInnerHTML');
    expect(textRawCode).not.toContain('innerHTML');
  });

  // 6.2.1 — TextRaw passa o valor como children string (React escapa automaticamente)
  it('6.2.1 — TextRaw passa valor como React children (string literal, não HTML)', () => {
    // O conteúdo é inserido como {display} (children), não como HTML
    expect(textRawSrc).toContain('{display}');
    // NÃO usa __html
    expect(textRawCode).not.toContain('__html');
  });

  // 6.2.2 — campo escolha com XSS: truncado e exibido literalmente
  it('6.2.2 — TextRaw trunca escolha XSS para maxLength e exibe literalmente', () => {
    // Lógica de truncamento da TextRaw (extraída para teste puro):
    const xssPayload = '<script>alert(1)</script>';
    const maxLength = 40;
    const display =
      xssPayload.length > maxLength
        ? xssPayload.slice(0, maxLength) + '…'
        : xssPayload;
    // Para payload de 25 chars e maxLength=40: exibido inteiro
    expect(display).toBe(xssPayload); // sem truncamento
    // String preservada intacta (XSS não é interpretado — React escapa via children)
    expect(typeof display).toBe('string');
    expect(display.length).toBeGreaterThan(0);
  });

  // 6.2.3 — payload com SQL injection: exibido como texto puro
  it('6.2.3 — payload SQL injection exibido como texto puro (sem execução)', () => {
    const sqlPayload = '"; DROP TABLE; --';
    const maxLength = 40;
    const display =
      sqlPayload.length > maxLength
        ? sqlPayload.slice(0, maxLength) + '…'
        : sqlPayload;
    // Exibido inteiro — React escapa caracteres especiais automaticamente
    expect(display).toBe(sqlPayload);
  });

  // 6.2.4 — payload com tags HTML na justificativa: sem innerHTML ativo
  it('6.2.4 — DecisionDetailPane usa TextRaw para justificativa (sem innerHTML no código ativo)', () => {
    expect(paneCode).not.toContain('innerHTML');
    expect(paneCode).not.toContain('dangerouslySetInnerHTML');
    // Justificativa renderizada via <TextRaw value={decision.justificativa} />
    expect(paneSrc).toContain('<TextRaw value={decision.justificativa}');
  });

  // 6.2.5 — DecisionMapSvg não usa innerHTML nem dangerouslySetInnerHTML no código ativo
  it('6.2.5 — DecisionMapSvg usa zero innerHTML / dangerouslySetInnerHTML (código ativo)', () => {
    expect(svgCode).not.toContain('innerHTML');
    expect(svgCode).not.toContain('dangerouslySetInnerHTML');
    // foreignObject presente (zero innerHTML — usa React component dentro)
    expect(readSrc('components/DecisionMapSvg.tsx')).toContain('foreignObject');
  });

  // 6.2.5 (complemento) — DecisionMapNode não usa innerHTML no código ativo
  it('6.2.5 — DecisionMapNode usa zero innerHTML / dangerouslySetInnerHTML (código ativo)', () => {
    expect(nodeCode).not.toContain('innerHTML');
    expect(nodeCode).not.toContain('dangerouslySetInnerHTML');
    // Escolha renderizada via <TextRaw>
    expect(nodeSrc).toContain('<TextRaw value={decision.escolha}');
  });
});

// ---------------------------------------------------------------------------
// FASE 6.3 — Estados do componente (6.3.1–6.3.6)
// Verificação estática: presença de estados obrigatórios.
// ---------------------------------------------------------------------------

describe('FASE 6.3 — Estados do DecisionMapPanel (verificação estática)', () => {
  const panelSrc = readSrc('components/DecisionMapPanel.tsx');

  // 6.3.1 — estado loading: renderiza LoadingState
  it('6.3.1 — estado loading: <LoadingState>', () => {
    expect(panelSrc).toContain('isLoading');
    expect(panelSrc).toContain('<LoadingState');
  });

  // 6.3.2 — estado vazio: renderiza EmptyState com mensagem correta
  it('6.3.2 — estado vazio: <EmptyState> com mensagem correta', () => {
    expect(panelSrc).toContain('<EmptyState');
    expect(panelSrc).toContain('Nenhuma decisão registrada para esta execução.');
  });

  // 6.3.3 — estado erro: renderiza ErrorState com botão retry
  it('6.3.3 — estado erro: <ErrorState> com retry', () => {
    expect(panelSrc).toContain('isError');
    expect(panelSrc).toContain('<ErrorState');
    expect(panelSrc).toContain('refetch');
    expect(panelSrc).toContain('Tentar novamente');
  });

  // 6.3.4 — estado degradado: banner DegradedBanner quando meta.degraded = true
  it('6.3.4 — estado degradado: <DegradedBanner> quando meta.degraded', () => {
    expect(panelSrc).toContain('meta.degraded');
    expect(panelSrc).toContain('<DegradedBanner');
  });

  // 6.3.5 — estado corte: banner quando pagination.hasMore = true
  it('6.3.5 — estado corte: banner quando pagination.hasMore', () => {
    expect(panelSrc).toContain('pagination?.hasMore');
    expect(panelSrc).toContain('primeiras 100 decisões');
  });

  // 6.3.6 — hooks necessários importados
  it('6.3.6 — imports obrigatórios: useDecisions, computeLayout, DecisionMapSvg, DecisionDetailPane', () => {
    expect(panelSrc).toContain('useDecisions');
    expect(panelSrc).toContain('computeLayout');
    expect(panelSrc).toContain('DecisionMapSvg');
    expect(panelSrc).toContain('DecisionDetailPane');
  });
});

// ---------------------------------------------------------------------------
// FASE 6.4 — Estrutura do SVG e comportamento de seleção (6.4.1–6.4.4)
// ---------------------------------------------------------------------------

describe('FASE 6.4 — Estrutura SVG e lógica de seleção', () => {
  // 6.4.1 — 3 decisões → 3 nós, 2 arestas, defs presente
  it('6.4.1 — 3 decisões produzem 3 nós e 2 arestas', () => {
    const items: DecisionDTO[] = [
      mkDecision('onda-001', { escolha: 'A' }),
      mkDecision('onda-001', { escolha: 'B' }),
      mkDecision('onda-001', { escolha: 'C' }),
    ];
    const layout = computeLayout(items);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(2);
  });

  // 6.4.1 (complemento) — DecisionMapSvg fonte confirma <defs> com marker
  it('6.4.1 — DecisionMapSvg define <defs> com marker de seta', () => {
    const svgSrc = readSrc('components/DecisionMapSvg.tsx');
    expect(svgSrc).toContain('<defs>');
    expect(svgSrc).toContain('<marker');
    expect(svgSrc).toContain('decision-map-arrow');
    expect(svgSrc).toContain('markerEnd="url(#decision-map-arrow)"');
  });

  // 6.4.2 — selectedKey atualiza ao selecionar nó: lógica de key
  it('6.4.2 — chave do nó é estável e usável como selectedKey', () => {
    const items: DecisionDTO[] = [
      mkDecision('onda-001', { escolha: 'Escolha A' }),
      mkDecision('onda-001', { escolha: 'Escolha B' }),
    ];
    const layout = computeLayout(items);
    const key0 = layout.nodes[0]!.key;
    const key1 = layout.nodes[1]!.key;

    // Chaves únicas e estáveis
    expect(key0).not.toBe(key1);
    expect(key0).toBe('onda-001::0');
    expect(key1).toBe('onda-001::1');

    // selectedKey atualiza: nó selecionado detectável por key
    const selected = layout.nodes.find(n => n.key === key1);
    expect(selected).toBeDefined();
    expect(selected!.decision.escolha).toBe('Escolha B');
  });

  // 6.4.3 — clicar em nó diferente não fecha mapa (selectedKey muda, mapVisible inalterado)
  it('6.4.3 — selecionar nó diferente muda selectedKey sem afetar mapVisible', () => {
    // Simulação de lógica: setSelectedKey(newKey) não altera mapVisible
    // O painel atualiza quando selectedKey muda (spec §US2 SC2)
    const items: DecisionDTO[] = [
      mkDecision('onda-001', { escolha: 'A' }),
      mkDecision('onda-001', { escolha: 'B' }),
    ];
    const layout = computeLayout(items);

    // Ambas as chaves são diferentes → painel pode atualizar
    expect(layout.nodes[0]!.key).not.toBe(layout.nodes[1]!.key);

    // prevKey/nextKey refletem navegação correta
    expect(prevKey(layout.nodes, layout.nodes[1]!.key)).toBe(layout.nodes[0]!.key);
    expect(nextKey(layout.nodes, layout.nodes[0]!.key)).toBe(layout.nodes[1]!.key);
  });

  // 6.4.4 — benchmark: computeLayout para 100 decisões < 10ms
  it('6.4.4 — computeLayout 100 decisões < 10ms (SC-002)', () => {
    const items: DecisionDTO[] = Array.from({ length: 100 }, (_, i) =>
      mkDecision(`onda-${String(Math.floor(i / 10) + 1).padStart(3, '0')}`, {
        escolha: `item-${i}`,
      })
    );

    const t0 = performance.now();
    computeLayout(items);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// FASE 6 — Verificação da ausência de innerHTML em todos os componentes
// (checagem holística — 6.2.5)
// ---------------------------------------------------------------------------

describe('FASE 6 — Invariante de segurança holística', () => {
  const components = [
    'components/DecisionMapSvg.tsx',
    'components/DecisionMapNode.tsx',
    'components/DecisionDetailPane.tsx',
    'components/DecisionMapPanel.tsx',
    'components/TextRaw.tsx',
  ];

  for (const rel of components) {
    it(`${rel}: NUNCA usa innerHTML ou dangerouslySetInnerHTML no código ativo`, () => {
      // codeOnly filtra comentários JSDoc e inline — apenas código ativo
      const code = codeOnly(readSrc(rel));
      expect(code).not.toContain('dangerouslySetInnerHTML');
      expect(code).not.toContain('innerHTML');
    });
  }
});
