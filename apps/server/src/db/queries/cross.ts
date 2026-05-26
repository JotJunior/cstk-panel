/**
 * Queries cross-execucao: alertas, tasks e events agregados.
 * Ref: contracts/api-read.md §Cross-execucao; spec.md FR-008, FR-009
 * Task 3.3.5
 *
 * Principio I (Read-Only Absoluto): apenas SELECT com prepared statements.
 * Todos os filtros via binding parametrizado — nunca interpolacao de string.
 *
 * Filtros suportados:
 * - alerts: tipo, project, feature, period (24h/7d/30d/all)
 * - tasks:  project, feature, outcome
 * - events: event_type, project, period
 */
import type Database from 'better-sqlite3';
import { tituloSelect } from './tasks.js';

// ─────────────────────────────────────────────────────────
// Tipos de filtro
// ─────────────────────────────────────────────────────────

export type Period = '24h' | '7d' | '30d' | 'all';

function periodToSqlFilter(period: Period | undefined): string | null {
  switch (period) {
    case '24h': return "datetime('now', '-1 day')";
    case '7d':  return "datetime('now', '-7 days')";
    case '30d': return "datetime('now', '-30 days')";
    case 'all':
    default:    return null;
  }
}

export interface CrossAlertFilters {
  tipo?: string;
  project?: string;
  feature?: string;
  period?: Period;
  limit?: number;
  offset?: number;
}

export interface CrossTaskFilters {
  project?: string;
  feature?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}

export interface CrossEventFilters {
  event_type?: string;
  project?: string;
  period?: Period;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────
// Row shapes
// ─────────────────────────────────────────────────────────

export interface CrossAlertRow {
  execucao_id: string;
  project: string;
  feature: string;
  tipo: string;
  subtipo: string | null;
  valor_consumido: number | null;
  valor_threshold: number | null;
  descricao: string | null;
  wave: string;
}

export interface CrossTaskRow {
  wave: string;
  execucao_id: string;
  project: string;
  feature: string;
  titulo: string;                     // schema v3; '' em bases v2 (FR-V3-005)
  outcome: string | null;
  testes_rodados: number | null;
  testes_passados: number | null;
  lint_ok: number | null;
  arquivos_tocados: number | null;
}

export interface CrossEventRow {
  execucao_id: string;
  project: string;
  feature: string;
  event_type: string;
  timestamp: string;
  descricao: string | null;
}

// ─────────────────────────────────────────────────────────
// GET /alerts (cross-execucao)
// ─────────────────────────────────────────────────────────

/**
 * Lista alertas cross-execucao com filtros opcionais.
 * JOIN com executions para incluir project e feature (drill-down).
 */
export function listCrossAlerts(
  db: Database.Database,
  filters: CrossAlertFilters = {}
): CrossAlertRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.tipo !== undefined) {
    conditions.push('a.tipo = ?');
    params.push(filters.tipo);
  }
  if (filters.project !== undefined) {
    conditions.push('e.project = ?');
    params.push(filters.project);
  }
  if (filters.feature !== undefined) {
    conditions.push('e.feature = ?');
    params.push(filters.feature);
  }

  const periodFilter = periodToSqlFilter(filters.period);
  if (periodFilter) {
    // alert_signals nao tem timestamp proprio — usar executions.iniciada_em
    conditions.push(`e.iniciada_em >= ${periodFilter}`);
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(`
      SELECT a.execucao_id, e.project, e.feature,
             a.tipo, a.subtipo, a.valor_consumido, a.valor_threshold,
             a.descricao, a.wave
      FROM alert_signals a
      JOIN executions e ON e.execucao_id = a.execucao_id
      ${where}
      ORDER BY a.rowid DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params) as CrossAlertRow[];
}

/** Contagem de alertas cross-execucao (para paginacao) */
export function countCrossAlerts(
  db: Database.Database,
  filters: Omit<CrossAlertFilters, 'limit' | 'offset'> = {}
): number {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.tipo !== undefined) {
    conditions.push('a.tipo = ?');
    params.push(filters.tipo);
  }
  if (filters.project !== undefined) {
    conditions.push('e.project = ?');
    params.push(filters.project);
  }
  if (filters.feature !== undefined) {
    conditions.push('e.feature = ?');
    params.push(filters.feature);
  }

  const periodFilter = periodToSqlFilter(filters.period);
  if (periodFilter) {
    conditions.push(`e.iniciada_em >= ${periodFilter}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const row = db
    .prepare(`
      SELECT count(*) as n
      FROM alert_signals a
      JOIN executions e ON e.execucao_id = a.execucao_id
      ${where}
    `)
    .get(...params) as { n: number };
  return row.n;
}

// ─────────────────────────────────────────────────────────
// GET /tasks (cross-execucao)
// ─────────────────────────────────────────────────────────

/**
 * Lista tasks cross-execucao com filtros opcionais.
 * JOIN com executions para incluir project e feature.
 */
export function listCrossTasks(
  db: Database.Database,
  filters: CrossTaskFilters = {}
): CrossTaskRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.project !== undefined) {
    conditions.push('e.project = ?');
    params.push(filters.project);
  }
  if (filters.feature !== undefined) {
    conditions.push('e.feature = ?');
    params.push(filters.feature);
  }
  if (filters.outcome !== undefined) {
    conditions.push('t.outcome = ?');
    params.push(filters.outcome);
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(`
      SELECT t.wave, t.execucao_id, e.project, e.feature,
             ${tituloSelect(db, 't.')},
             t.outcome, t.testes_rodados, t.testes_passados,
             t.lint_ok, t.arquivos_tocados
      FROM tasks t
      JOIN executions e ON e.execucao_id = t.execucao_id
      ${where}
      ORDER BY t.rowid ASC
      LIMIT ? OFFSET ?
    `)
    .all(...params) as CrossTaskRow[];
}

// ─────────────────────────────────────────────────────────
// GET /events (cross-execucao)
// ─────────────────────────────────────────────────────────

/**
 * Lista eventos cross-execucao com filtros opcionais.
 * JOIN com executions para incluir project e feature.
 */
export function listCrossEvents(
  db: Database.Database,
  filters: CrossEventFilters = {}
): CrossEventRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.event_type !== undefined) {
    conditions.push('ev.event_type = ?');
    params.push(filters.event_type);
  }
  if (filters.project !== undefined) {
    conditions.push('e.project = ?');
    params.push(filters.project);
  }

  const periodFilter = periodToSqlFilter(filters.period);
  if (periodFilter) {
    conditions.push(`ev.timestamp >= ${periodFilter}`);
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(`
      SELECT ev.execucao_id, e.project, e.feature,
             ev.event_type, ev.timestamp, ev.descricao
      FROM events ev
      JOIN executions e ON e.execucao_id = ev.execucao_id
      ${where}
      ORDER BY ev.timestamp ASC
      LIMIT ? OFFSET ?
    `)
    .all(...params) as CrossEventRow[];
}
