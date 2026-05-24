/**
 * Envelope padrao ApiEnvelope<T> — envelope de toda resposta da API.
 * Ref: contracts/envelope.md; spec.md FR-023; Principio VI (Snapshot que Muda)
 */

/**
 * Informacoes de frescor do snapshot.
 * mtime: ultima modificacao do arquivo knowledge.db (ISO 8601)
 * maxIngestedAt: max(ingested_at) das execucoes na base (ISO 8601)
 */
export interface Freshness {
  mtime: string;        // ISO 8601 — mtime do arquivo DB
  maxIngestedAt: string; // ISO 8601 — max(ingested_at) das execucoes
}

/**
 * Metadados do envelope — presentes em TODA resposta (200 e degradada).
 * degraded: true indica que o servidor esta operando em modo degradado.
 * reason: motivo da degradacao (null se ok).
 * freshness: informacoes de frescor do snapshot (obrigatorio — FR-014).
 * schemaVersion: versao do schema da knowledge.db que o servidor validou.
 * approximate: true se alguma metrica e derivada/estimada (Principio III).
 */
export interface Meta {
  degraded: boolean;           // obrigatorio — nunca omitido
  reason: string | null;       // motivo da degradacao, null se ok
  freshness: Freshness;        // obrigatorio — FR-014
  schemaVersion: string;       // versao do schema validada ('2')
  approximate?: boolean;       // presente apenas quando true (Principio III)
}

/**
 * Envelope padrao de toda resposta da API.
 * data: null quando degraded=true (nao ha dados confiaveis).
 * meta: sempre presente, mesmo em erro/degradacao.
 */
export interface ApiEnvelope<T> {
  data: T | null;
  meta: Meta;
}

/**
 * Tipos de motivo de degradacao (Principio II — Degradar, Nunca Quebrar).
 */
export type DegradedReason =
  | 'db-missing'       // arquivo knowledge.db nao encontrado
  | 'db-corrupt'       // PRAGMA quick_check retornou != 'ok'
  | 'schema-mismatch'  // schema_version != '2' em schema_meta
  | 'table-empty';     // tabela sem dados por entidade consultada
