/**
 * Watcher de ingestao em segundo plano (US1, FR-001/FR-003/FR-004/FR-013/FR-014).
 *
 * Verifica recorrentemente execucoes agente-00c/feature-00c ativas na
 * knowledge.db e DELEGA a ingestao canonica `cstk recall --ingest` via
 * subprocesso seguro — NUNCA escreve na knowledge.db, NUNCA toca
 * `state.json`, NUNCA roda `--reindex` (Principio I; Constitution IV Opcao B).
 *
 * Ref: research.md Decisions 2, 3, 4, 9; contracts/watchers.md; tasks.md FASE 2
 *
 * Derivacao do state-dir (Decision 3) — nota de implementacao verificada
 * empiricamente (task 2.1.3): o layout REAL em disco desta execucao
 * (`.claude/feature-00c-state/<feature>/`, sem sub-diretorio por sessao —
 * `session`/`session_name` e apenas metadado em `.execution.session_name`
 * dentro do state.json, nunca um componente de path) confirma que a derivacao
 * usa somente `projectPath` + presenca/ausencia de `feature`. `session` NAO
 * participa da composicao do path.
 */
import { execFile as execFileCb } from 'node:child_process';
import { accessSync, constants as fsConstants, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter as pathDelimiter, join, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { openDb } from '../db/open.js';
import { listActiveExecutions, type ActiveExecutionRow } from '../db/queries/executions.js';
import { resolveProjectPath } from '../config.js';

// ---------------------------------------------------------------------------
// Constantes / defaults configuraveis via env (task 2.1.1, 2.3.4)
// ---------------------------------------------------------------------------

/**
 * Cadencia do timer do watcher — AJUSTADA empiricamente (task 2.3.4, CHK045/CHK057).
 *
 * Medicao real (nao estimada): `time cstk recall --ingest --state-dir <SD> --db <scratch.db>`
 * contra o `state.json` desta propria feature (49015 bytes, 6 ondas, 34 decisoes,
 * 11 skills, 11 memories) em 2026-07-15 — resultado literal:
 *   "3,68s user 6,01s system 83% cpu 11,644 total"
 * ⇒ ingestao real ~11.6s, ACIMA do "~10s" que research.md Decision 5 apontava como
 * limiar para ajustar a cadencia. Orcamento (Decision 5): cadencia_watcher +
 * duracao_ingestao + polling_cliente(10s) <= 30s (SC-001). Com cadencia=10_000 o
 * PIOR CASO seria 10 + 11.6 + 10 = 31.6s (estoura o orcamento). Reduzindo a
 * cadencia para 5_000, o pior caso cai para 5 + 11.6 + 10 = 26.6s — dentro de 30s
 * com folga. (state.json maiores que o medido aqui podem reintroduzir a folga
 * apertada; CSTK_WATCH_INTERVAL_MS permite ao operador re-ajustar sem rebuild.)
 */
export const DEFAULT_WATCH_INTERVAL_MS = 5_000;
/**
 * Timeout do subprocesso `cstk recall --ingest`. Medicao real (task 2.3.4) foi
 * ~11.6s para o state.json desta feature — 20s mantem ~1.7x de folga sobre o
 * medido antes de matar o subprocesso.
 */
export const DEFAULT_SUBPROCESS_TIMEOUT_MS = 20_000;
/** Cap de subprocessos `cstk` concorrentes por tick (Decision 9, item 3). */
export const DEFAULT_MAX_CONCURRENT = 4;
/** Backoff apos falha: pula re-tentativa para o mesmo state-dir por este intervalo. */
export const DEFAULT_BACKOFF_MS = 60_000;

/** Regex anti-traversal para `feature` vindo da knowledge.db (UNTRUSTED, Principio V).
 *  Identica a validacao de path params HTTP (`FeatureParamSchema`, routes/features.ts). */
const SAFE_SEGMENT_RE = /^[^/\\.<>]+$/;

// ---------------------------------------------------------------------------
// Cache de assinatura em memoria (task 2.2.1) — NUNCA persistido (Principio I)
// ---------------------------------------------------------------------------

export interface WatcherCacheEntry {
  /** ultima assinatura vista (mtimeMs de state.json como string) — null se state.json ilegivel */
  signature: string | null;
  /** epoch ms da ultima ingestao bem-sucedida; null se nunca */
  lastIngestAt: number | null;
  /** mensagem da ultima falha; null se nunca falhou (ou se a ultima tentativa apos a falha teve sucesso) */
  lastError: string | null;
  /** epoch ms da ultima falha; null se nunca */
  lastErrorAt: number | null;
}

const signatureCache = new Map<string, WatcherCacheEntry>();

/** Leitura do cache por state-dir — consumido pelo endpoint de detalhe (task 2.4). */
export function getWatcherCacheEntry(stateDir: string): WatcherCacheEntry | undefined {
  return signatureCache.get(stateDir);
}

/** Escrita direta no cache — uso exclusivo de testes (simula estado apos falha/sucesso sem rodar um tick real). */
export function setWatcherCacheEntryForTests(stateDir: string, entry: WatcherCacheEntry): void {
  signatureCache.set(stateDir, entry);
}

/** Reset total do cache — uso exclusivo de testes (isolamento entre casos). */
export function resetWatcherCacheForTests(): void {
  signatureCache.clear();
}

/**
 * Task 2.4.1 (CHK056/dec-027): true quando a ULTIMA falha registrada para o
 * state-dir e mais recente que a ultima ingestao bem-sucedida (ou quando NUNCA
 * houve sucesso). Consumido por `GET /executions/:executionId` para sinalizar
 * `meta.degraded:true` / `meta.reason:'watcher-ingestion-failed'` SEM nulificar
 * `data` — a execucao em si foi lida com sucesso da knowledge.db; apenas o
 * watcher (mecanismo de frescor em segundo plano) esta com a ultima tentativa
 * de ingestao falha para aquele state-dir especifico.
 */
export function isWatcherDegraded(entry: WatcherCacheEntry | undefined): boolean {
  if (!entry || entry.lastError === null || entry.lastErrorAt === null) return false;
  if (entry.lastIngestAt === null) return true; // falhou e nunca teve sucesso
  return entry.lastErrorAt > entry.lastIngestAt;
}

// ---------------------------------------------------------------------------
// Derivacao de state-dir (task 2.1.3, 2.3.2 — hardening anti-traversal)
// ---------------------------------------------------------------------------

function isSafeSegment(value: string): boolean {
  return SAFE_SEGMENT_RE.test(value);
}

/**
 * Deriva o state-dir de uma execucao observada (Decision 3).
 * - feature-00c (feature nao-nula/nao-vazia): `<projectPath>/.claude/feature-00c-state/<feature>/`
 * - agente-00c (feature nula/vazia): `<projectPath>/.claude/agente-00c-state/`
 *
 * `feature` e UNTRUSTED (vem da knowledge.db, Principio V): validada com o
 * MESMO regex anti-traversal aplicado aos path params HTTP ANTES de compor o
 * path (Decision 9, item 2) — nao apenas checagem de existencia depois.
 * Retorna `null` quando `feature` falha a validacao (nunca lanca, Principio II).
 */
export function deriveStateDir(projectPath: string, feature: string | null): string | null {
  const trimmed = feature?.trim() ?? '';
  if (trimmed === '') {
    return join(projectPath, '.claude', 'agente-00c-state');
  }
  if (!isSafeSegment(trimmed)) return null;
  return join(projectPath, '.claude', 'feature-00c-state', trimmed);
}

/** Assinatura barata de mudanca: mtimeMs de `state.json` (Decision 4 — mtime escolhido sobre sha256). */
function computeSignature(stateDir: string): string | null {
  try {
    const st = statSync(join(stateDir, 'state.json'));
    return String(st.mtimeMs);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Resolucao do binario `cstk` (task 2.3.1 — anti PATH-hijack, gate owasp medium)
// ---------------------------------------------------------------------------

/**
 * Verificado empiricamente (node -e com execFile('cstk',...) sem shell:true):
 * o Node resolve nomes de programa sem separador de path varrendo `PATH` (via
 * libuv/execvp) mesmo sem `shell:true`. Isso expõe risco de PATH hijack (um
 * diretorio malicioso anteposto no PATH pode sombrear o `cstk` real). Mitigacao:
 * resolver nos MESMOS diretorios do PATH explicitamente, uma vez, cacheado, e
 * sempre invocar `execFile` com o caminho ABSOLUTO resolvido — nunca o nome
 * relativo 'cstk'.
 */
let cachedCstkBinary: string | null | undefined;

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, fsConstants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Resolve `cstk` a caminho absoluto verificado. `CSTK_BINARY_PATH` pina explicitamente (maior prioridade). */
export function resolveCstkBinary(): string | null {
  if (cachedCstkBinary !== undefined) return cachedCstkBinary;

  const pinned = process.env['CSTK_BINARY_PATH'];
  if (pinned && pinned.trim() !== '') {
    const candidate = resolve(pinned.trim());
    cachedCstkBinary = isExecutableFile(candidate) ? candidate : null;
    return cachedCstkBinary;
  }

  const pathEnv = process.env['PATH'] ?? '';
  for (const dir of pathEnv.split(pathDelimiter)) {
    if (dir.trim() === '') continue;
    const candidate = join(dir, 'cstk');
    if (isExecutableFile(candidate)) {
      cachedCstkBinary = candidate;
      return candidate;
    }
  }
  cachedCstkBinary = null;
  return null;
}

/** Uso exclusivo de testes — evita vazamento de cache entre casos. */
export function resetCstkBinaryCacheForTests(): void {
  cachedCstkBinary = undefined;
}

/**
 * env minimo passado ao subprocesso (Decision 9, item 1): PATH (o `cstk` pode
 * invocar sub-ferramentas do proprio toolkit) + HOME (resolucao de `~/.claude/...`
 * internamente ao `cstk`). NENHUMA outra variavel do processo pai e herdada.
 */
function minimalSubprocessEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env['PATH'] ?? '',
    HOME: process.env['HOME'] ?? homedir(),
  };
}

// ---------------------------------------------------------------------------
// Subprocesso injetavel (testabilidade — task 2.1.6, 2.3.5)
// ---------------------------------------------------------------------------

export interface ExecFileResult {
  stdout: string;
  stderr: string;
}

export type ExecFileFn = (
  file: string,
  args: string[],
  options: { timeout: number; env: NodeJS.ProcessEnv; cwd: string }
) => Promise<ExecFileResult>;

/** Implementacao real — args SEMPRE em array (nunca shell-string interpolada). */
const defaultExecFile: ExecFileFn = (file, args, options) =>
  new Promise((resolvePromise, rejectPromise) => {
    execFileCb(file, args, options, (error, stdout, stderr) => {
      if (error) {
        rejectPromise(Object.assign(error, { stdout: String(stdout), stderr: String(stderr) }));
        return;
      }
      resolvePromise({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

// ---------------------------------------------------------------------------
// Tick (task 2.1.2, 2.1.4, 2.1.5, 2.2.3, 2.3.3)
// ---------------------------------------------------------------------------

export interface WatcherTickOptions {
  dbPath: string;
  supportedSchemaVersions: string[];
  execFileImpl?: ExecFileFn;
  maxConcurrent?: number;
  subprocessTimeoutMs?: number;
  backoffMs?: number;
  /** injetavel para testes deterministicos de backoff */
  now?: () => number;
}

export type TickSkipReason =
  | 'project-path-unresolved'
  | 'project-path-inaccessible'
  | 'unsafe-feature-segment'
  | 'signature-unchanged'
  | 'backoff-active'
  | 'ingest-failed';

export interface WatcherTickResult {
  /** true quando a consulta a knowledge.db falhou (DB ausente/corrupto/schema) — tick ocioso, Principio II */
  degradedDb: boolean;
  /** true quando o binario `cstk` nao foi resolvido — nenhum subprocesso pode ser disparado */
  cstkUnresolved: boolean;
  /** numero de execucoes ativas encontradas na knowledge.db (antes do cap de concorrencia) */
  activeCount: number;
  /** numero de subprocessos `cstk recall --ingest` de fato disparados */
  triggered: number;
  /** numero de execucoes ativas puladas nesta tick (idempotencia, degradacao, backoff, cap) */
  skipped: number;
}

/** Executa UM tick do watcher. Read-only sobre a knowledge.db; abre/fecha por tick (Principio VI). */
export async function runWatcherTick(opts: WatcherTickOptions): Promise<WatcherTickResult> {
  const openResult = openDb(opts.dbPath, opts.supportedSchemaVersions);
  if (!openResult.ok) {
    return { degradedDb: true, cstkUnresolved: false, activeCount: 0, triggered: 0, skipped: 0 };
  }

  let rows: ActiveExecutionRow[];
  try {
    rows = listActiveExecutions(openResult.db as Database.Database);
  } finally {
    openResult.db.close();
  }

  if (rows.length === 0) {
    // Ociosidade (FR-013, AC US1-3): NENHUM subprocesso disparado.
    return { degradedDb: false, cstkUnresolved: false, activeCount: 0, triggered: 0, skipped: 0 };
  }

  const cstkBin = resolveCstkBinary();
  if (!cstkBin) {
    // Falha segura (Principio II): binario nao resolvido, nenhum subprocesso disparado.
    return { degradedDb: false, cstkUnresolved: true, activeCount: rows.length, triggered: 0, skipped: rows.length };
  }

  const cap = opts.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  const targets = rows.slice(0, cap); // bound de concorrencia por tick (Decision 9, item 3)
  const execImpl = opts.execFileImpl ?? defaultExecFile;
  const nowFn = opts.now ?? Date.now;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const timeoutMs = opts.subprocessTimeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS;

  let triggered = 0;
  let skipped = rows.length - targets.length; // excedentes ao cap desta tick

  await Promise.all(
    targets.map(async row => {
      const projectPath = resolveProjectPath(row.project);
      if (!projectPath) { skipped++; return; } // FR-008/FR-012 — projeto nao mapeado

      const stateDir = deriveStateDir(projectPath, row.feature);
      if (!stateDir) { skipped++; return; } // feature falhou anti-traversal (Decision 9)
      if (!existsSync(stateDir)) { skipped++; return; } // state-dir nao existe no FS (FR-012)

      const cached = signatureCache.get(stateDir);
      const nowMs = nowFn();
      if (cached?.lastErrorAt !== null && cached?.lastErrorAt !== undefined && (nowMs - cached.lastErrorAt) < backoffMs) {
        skipped++; return; // backoff ativo apos falha persistente (Decision 9, item 3)
      }

      const sig = computeSignature(stateDir);
      if (sig !== null && cached?.signature === sig) {
        skipped++; return; // idempotencia (FR-014) — state.json nao mudou desde a ultima vista
      }

      try {
        await execImpl(cstkBin, ['recall', '--ingest', '--state-dir', stateDir, '--db', opts.dbPath], {
          timeout: timeoutMs,
          env: minimalSubprocessEnv(),
          cwd: stateDir,
        });
        signatureCache.set(stateDir, { signature: sig, lastIngestAt: nowMs, lastError: null, lastErrorAt: null });
        triggered++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        signatureCache.set(stateDir, {
          signature: cached?.signature ?? null,
          lastIngestAt: cached?.lastIngestAt ?? null,
          lastError: message,
          lastErrorAt: nowMs,
        });
        skipped++;
      }
    })
  );

  return { degradedDb: false, cstkUnresolved: false, activeCount: rows.length, triggered, skipped };
}

// ---------------------------------------------------------------------------
// Ciclo de vida do timer (task 2.1.1, 2.5.1, 2.5.2)
// ---------------------------------------------------------------------------

export interface WatcherHandle {
  stop: () => void;
}

export interface StartWatcherOptions extends Omit<WatcherTickOptions, 'now'> {
  intervalMs?: number;
  /** logger minimo — evita acoplar o modulo ao tipo concreto do Fastify logger */
  onTickError?: (err: unknown) => void;
}

/** Inicia o timer recorrente. Retorna handle com `stop()` para shutdown limpo (task 2.5.2). */
export function startIngestWatcher(opts: StartWatcherOptions): WatcherHandle {
  const interval = opts.intervalMs ?? DEFAULT_WATCH_INTERVAL_MS;
  const timer = setInterval(() => {
    runWatcherTick(opts).catch(err => {
      opts.onTickError?.(err);
    });
  }, interval);
  // unref: o timer do watcher NUNCA deve, por si so, impedir o processo de
  // encerrar (ex.: em testes/scripts que sobem o server e finalizam sem
  // shutdown explicito). server.addHook('onClose', stop) ainda cobre o
  // shutdown normal do processo long-running.
  timer.unref();
  return {
    stop: () => clearInterval(timer),
  };
}
