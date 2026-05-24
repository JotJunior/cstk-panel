/**
 * Camada de abertura do banco — degradacao de 1a classe.
 * NUNCA lanca excecao: retorna { ok: true, db } ou { ok: false, reason }.
 *
 * Principio II (Degradar, Nunca Quebrar): o servidor DEVE operar em modo
 * degradado quando o DB esta ausente, corrompido ou com schema incompativel.
 * Principio I (Read-Only Absoluto): abre com { readonly: true } + PRAGMA
 * query_only = 1 — impossivel executar mutacao mesmo por descuido.
 *
 * Ref: research.md §Decision 1, §Decision 8; spec.md FR-002, FR-005, FR-007
 * Tasks: 3.2.1 – 3.2.5
 */
import Database from 'better-sqlite3';
import type { DegradedReason } from '@cstk-panel/shared-types';

// Re-exportar DegradedReason para conveniencia dos consumers deste modulo
export type { DegradedReason };

export type OpenResult =
  | { ok: true; db: Database.Database }
  | { ok: false; reason: DegradedReason };

/**
 * Abre knowledge.db em modo read-only estrito.
 * Retorna { ok: false, reason } para qualquer falha — nunca lanca.
 *
 * Sequencia de verificacao:
 * 1. Abrir arquivo (ENOENT → db-missing)
 * 2. PRAGMA query_only = 1 (imutabilidade runtime)
 * 3. PRAGMA quick_check (corrupcao → db-corrupt)
 * 4. SELECT schema_version FROM schema_meta (divergencia → schema-mismatch)
 * 5. COUNT(*) FROM executions (vazio → table-empty)
 */
export function openDb(dbPath: string): OpenResult {
  // Passo 1: tentar abrir o arquivo
  let db: Database.Database;
  try {
    // fileMustExist: false — tratamos ENOENT manualmente via erro de abertura
    // Nota: se o arquivo nao existe, better-sqlite3 cria um arquivo vazio;
    // detectamos esse caso via schema_meta ausente (schema-mismatch) ou
    // verificando o resultado do quick_check.
    // Para ENOENT real (path invalido), better-sqlite3 lanca erro.
    db = new Database(dbPath, { readonly: true, fileMustExist: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // SQLITE_CANTOPEN ou ENOENT
    if (
      msg.includes('ENOENT') ||
      msg.includes('SQLITE_CANTOPEN') ||
      msg.includes('unable to open')
    ) {
      return { ok: false, reason: 'db-missing' };
    }
    // Qualquer outro erro de abertura tratado como db-corrupt
    return { ok: false, reason: 'db-corrupt' };
  }

  try {
    // Passo 2: PRAGMA query_only = 1 (FR-002)
    db.pragma('query_only = 1');

    // Passo 3: PRAGMA quick_check — integridade basica (FR-007)
    const qcRows = db.pragma('quick_check') as Array<{ quick_check: string }>;
    const qcResult = qcRows[0]?.quick_check ?? 'error';
    if (qcResult !== 'ok') {
      db.close();
      return { ok: false, reason: 'db-corrupt' };
    }

    // Passo 4: validar schema_version === '2' (task 3.2.4)
    let schemaVersion: string | undefined;
    try {
      const row = db
        .prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'")
        .get() as { value: string } | undefined;
      schemaVersion = row?.value;
    } catch {
      // Tabela schema_meta inexistente (DB vazio criado agora)
      db.close();
      return { ok: false, reason: 'db-missing' };
    }

    if (schemaVersion !== '2') {
      db.close();
      return { ok: false, reason: 'schema-mismatch' };
    }

    // Passo 5: verificar se executions tem pelo menos 1 linha (task 3.2.5)
    const countRow = db
      .prepare('SELECT count(*) as n FROM executions')
      .get() as { n: number };
    if (countRow.n === 0) {
      db.close();
      return { ok: false, reason: 'table-empty' };
    }

    return { ok: true, db };
  } catch (err: unknown) {
    try { db.close(); } catch { /* ignorar erro de fechamento */ }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('SQLITE_CORRUPT') || msg.includes('malformed')) {
      return { ok: false, reason: 'db-corrupt' };
    }
    return { ok: false, reason: 'db-missing' };
  }
}
