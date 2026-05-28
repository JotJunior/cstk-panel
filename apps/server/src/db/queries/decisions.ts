/**
 * Queries read-only para entidade decisions.
 * Ref: data-model.md §Entity: Decision; spec.md FR-003; contracts/api-read.md
 * Task 3.3.3
 *
 * Campos textuais (contexto, justificativa, evidencia) sao UNTRUSTED —
 * chegam crus do DB, mapeados para DTO sem transformacao.
 * O FE renderiza via textContent, nunca innerHTML.
 */
import type Database from 'better-sqlite3';
import { hasColumn } from '../columns.js';

export interface DecisionRow {
  wave: string;
  execucao_id: string;
  etapa: string | null;
  agente: string | null;
  escolha: string | null;
  opcoes: string | null;              // schema v6; NULL em bases v<6 (FR-V3-005)
  score: number | null;
  contexto: string | null;
  justificativa: string | null;
  evidencia: string | null;
}

/**
 * Projecao de `opcoes` tolerante a bases v<6 (recall schema v6 adicionou a
 * coluna `decisions.opcoes`): coluna ausente → `NULL AS opcoes`, mantendo uma
 * unica forma de Row (Principio II — degradar em vez de quebrar).
 */
function opcoesSelect(db: Database.Database): string {
  return hasColumn(db, 'decisions', 'opcoes') ? 'opcoes' : 'NULL as opcoes';
}

export interface DecisionFilters {
  wave?: string;
  etapa?: string;
  score?: number;
  limit: number;
  offset: number;
}

/** Lista decisoes paginadas de uma execucao com filtros opcionais */
export function listDecisions(
  db: Database.Database,
  execucaoId: string,
  filters: DecisionFilters
): DecisionRow[] {
  // Construir WHERE dinamico com bindings posicionais (nunca interpolacao)
  const conditions: string[] = ['execucao_id = ?'];
  const params: unknown[] = [execucaoId];

  if (filters.wave !== undefined) {
    conditions.push('wave = ?');
    params.push(filters.wave);
  }
  if (filters.etapa !== undefined) {
    conditions.push('etapa = ?');
    params.push(filters.etapa);
  }
  if (filters.score !== undefined) {
    conditions.push('score = ?');
    params.push(filters.score);
  }

  // limit e offset sempre como bindings (SC-008)
  params.push(filters.limit, filters.offset);

  const where = conditions.join(' AND ');
  return db
    .prepare(`
      SELECT wave, execucao_id, etapa, agente, escolha, ${opcoesSelect(db)}, score,
             contexto, justificativa, evidencia
      FROM decisions
      WHERE ${where}
      ORDER BY rowid ASC
      LIMIT ? OFFSET ?
    `)
    .all(...params) as DecisionRow[];
}

/** Conta total de decisoes de uma execucao (para paginacao) */
export function countDecisions(
  db: Database.Database,
  execucaoId: string,
  filters: Omit<DecisionFilters, 'limit' | 'offset'>
): number {
  const conditions: string[] = ['execucao_id = ?'];
  const params: unknown[] = [execucaoId];

  if (filters.wave !== undefined) {
    conditions.push('wave = ?');
    params.push(filters.wave);
  }
  if (filters.etapa !== undefined) {
    conditions.push('etapa = ?');
    params.push(filters.etapa);
  }
  if (filters.score !== undefined) {
    conditions.push('score = ?');
    params.push(filters.score);
  }

  const where = conditions.join(' AND ');
  const row = db
    .prepare(`SELECT count(*) as n FROM decisions WHERE ${where}`)
    .get(...params) as { n: number };
  return row.n;
}

/** Distribuicao de score (0..3) das decisoes de UMA execucao (card lateral). */
export interface ScoreDistRow { score: number; count: number; }

export function getDecisionScoreDistribution(
  db: Database.Database,
  execucaoId: string
): ScoreDistRow[] {
  return db
    .prepare(`
      SELECT score, count(*) as count
      FROM decisions
      WHERE execucao_id = ? AND score IS NOT NULL
      GROUP BY score
      ORDER BY score ASC
    `)
    .all(execucaoId) as ScoreDistRow[];
}
