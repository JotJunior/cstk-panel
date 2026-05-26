/**
 * Helper de introspeccao de schema — tolerancia a colunas aditivas (v2→v3).
 * Ref: spec.md FR-V3-005; plan.md §Tolerancia a coluna ausente
 *
 * Uma base v2 nao tem `tasks.titulo`; um SELECT com a coluna lancaria. Em vez
 * de gateaer/quebrar (Principio II), checamos a existencia via PRAGMA e
 * projetamos `'' AS titulo` quando ausente — mantendo uma unica forma de Row.
 *
 * Cache por instancia de DB (WeakMap): PRAGMA table_info e barato, mas a
 * abertura e por-requisicao; o cache evita repetir dentro da mesma conexao.
 */
import type Database from 'better-sqlite3';

const cache = new WeakMap<Database.Database, Map<string, boolean>>();

/** True se a tabela possui a coluna. Read-only; nunca lanca para tabela ausente. */
export function hasColumn(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  const key = `${table}.${column}`;
  let perDb = cache.get(db);
  if (perDb === undefined) {
    perDb = new Map<string, boolean>();
    cache.set(db, perDb);
  }
  const cached = perDb.get(key);
  if (cached !== undefined) return cached;

  let exists = false;
  try {
    // PRAGMA table_info NAO aceita binding para o nome da tabela; o nome vem de
    // literais internos (nunca de input do usuario), entao a interpolacao e segura.
    const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    exists = rows.some(r => r.name === column);
  } catch {
    exists = false;
  }
  perDb.set(key, exists);
  return exists;
}
