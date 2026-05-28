/**
 * Queries read-only para a entidade `suggestions` (schema v5 — recall-suggestions).
 * Espelho de `state.json.sugestoes[]`: melhorias propostas pela IA a alguma skill
 * (diagnostico + proposta + referencias). Escopo por execucao; chave natural
 * (execucao_id, source_id). O painel apenas LE — a fonte canonica e o state.json.
 *
 * Tolerancia de schema (Principio II): bases v<5 NAO tem a tabela `suggestions`.
 * `hasTable` e checado antes e a query degrada para vazio, em vez de lancar.
 */
import type Database from 'better-sqlite3';
import { hasTable } from '../columns.js';

export interface SuggestionRow {
  execucao_id: string;
  source_id: string;
  skill_afetada: string | null;
  severidade: string | null;
  diagnostico: string | null;
  proposta: string | null;
  /** CSV de paths (join "," na ingestao); o mapper divide em array */
  referencias: string | null;
  issue_aberta: string | null;
  source_ts: string | null;
}

/** True se a base expoe a tabela `suggestions` (v5+). */
export function hasSuggestions(db: Database.Database): boolean {
  return hasTable(db, 'suggestions');
}

/**
 * Lista sugestoes de uma execucao, em ordem cronologica de criacao.
 * Degrada para [] em bases v<5 (sem a tabela).
 */
export function listSuggestionsByExecution(
  db: Database.Database,
  execucaoId: string
): SuggestionRow[] {
  if (!hasSuggestions(db)) return [];
  return db
    .prepare(`
      SELECT execucao_id, source_id, skill_afetada, severidade,
             diagnostico, proposta, referencias, issue_aberta, source_ts
      FROM suggestions
      WHERE execucao_id = ?
      ORDER BY source_ts ASC, source_id ASC
    `)
    .all(execucaoId) as SuggestionRow[];
}
