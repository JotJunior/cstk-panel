/**
 * Utilitario para montar ApiEnvelope<T> — envolve dados com Meta computado.
 * Ref: contracts/envelope.md; spec.md FR-023; Principio VI
 * Task 3.5.1
 *
 * Principio II (Degradar, Nunca Quebrar): wrap() aceita db=null (modo degradado)
 * e computa freshness fallback com strings vazias.
 * Principio VI (Snapshot que Muda): freshness e calculado a cada chamada.
 */
import type Database from 'better-sqlite3';
import type { ApiEnvelope, Meta, Freshness } from '@cstk-panel/shared-types';
import { computeFreshness } from '../db/freshness.js';

export interface WrapOptions {
  /** Se true, data sera null e degraded=true */
  degraded?: boolean;
  /** Motivo da degradacao (apenas se degraded=true) */
  reason?: string | null;
  /** Se true, alguma metrica e estimada (Principio III) */
  approximate?: boolean;
}

/**
 * Envolve dados no envelope padrao com meta computado automaticamente.
 *
 * @param data    Dados da resposta (null automaticamente se degraded=true)
 * @param opts    Opcoes de degradacao e metadados
 * @param dbPath  Path do arquivo DB (para computar mtime)
 * @param db      Instancia do banco (para max ingested_at); null em modo degradado
 */
export function wrap<T>(
  data: T | null,
  opts: WrapOptions,
  dbPath: string,
  db: Database.Database | null
): ApiEnvelope<T> {
  let freshness: Freshness;
  if (db !== null) {
    freshness = computeFreshness(dbPath, db);
  } else {
    freshness = { mtime: '', maxIngestedAt: '' };
  }

  const meta: Meta = {
    degraded: opts.degraded ?? false,
    reason: opts.reason ?? null,
    freshness,
    schemaVersion: '2',
    ...(opts.approximate ? { approximate: true } : {}),
  };

  return {
    data: opts.degraded ? null : data,
    meta,
  };
}

/**
 * Wrapper conveniente para respostas degradadas.
 */
export function wrapDegraded(
  reason: string,
  dbPath: string
): ApiEnvelope<null> {
  return wrap(null, { degraded: true, reason }, dbPath, null);
}
