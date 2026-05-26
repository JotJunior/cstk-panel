/**
 * Configuracao do servidor — resolucao do path do banco.
 * Ref: plan.md §Project Structure; spec.md FR-018
 *
 * Ordem de resolucao (FR-018):
 * 1. Variavel de ambiente CSTK_KNOWLEDGE_DB (config explicita)
 * 2. Default: ~/.claude/cstk/knowledge.db
 *
 * O path e canonicalizado via path.resolve para evitar path traversal.
 *
 * Versoes de schema aceitas (FR-V3-001): vindas do env CSTK_SCHEMA_VERSIONS
 * (CSV; default '2,3'). NUNCA hardcoded no guard de abertura — assim um
 * operador aceita uma versao futura sem rebuild ou trava numa so.
 */
import { homedir } from 'node:os';
import { resolve } from 'node:path';

/** Default quando CSTK_SCHEMA_VERSIONS nao esta definido — aceita v2 e v3. */
export const DEFAULT_SCHEMA_VERSIONS = ['2', '3'] as const;

export interface ServerConfig {
  /** Path absoluto canonicalizado para knowledge.db */
  dbPath: string;
  /** Porta do servidor HTTP (bind em localhost) */
  port: number;
  /** Host — SEMPRE 127.0.0.1 (FR-017: localhost bind) */
  host: string;
  /** Origem permitida para CORS */
  corsOrigin: string;
  /** Versoes de schema_meta.schema_version aceitas na abertura (FR-V3-001). */
  supportedSchemaVersions: string[];
}

function resolveDbPath(): string {
  const fromEnv = process.env['CSTK_KNOWLEDGE_DB'];
  if (fromEnv && fromEnv.trim() !== '') {
    return resolve(fromEnv.trim());
  }
  return resolve(homedir(), '.claude', 'cstk', 'knowledge.db');
}

/** Parseia CSTK_SCHEMA_VERSIONS (CSV) em lista; vazio/ausente → default. */
function resolveSchemaVersions(): string[] {
  const raw = process.env['CSTK_SCHEMA_VERSIONS'];
  if (!raw || raw.trim() === '') return [...DEFAULT_SCHEMA_VERSIONS];
  const parsed = raw.split(',').map(v => v.trim()).filter(v => v !== '');
  return parsed.length > 0 ? parsed : [...DEFAULT_SCHEMA_VERSIONS];
}

export function loadConfig(): ServerConfig {
  return {
    dbPath: resolveDbPath(),
    port: parseInt(process.env['PORT'] ?? '3001', 10),
    host: '127.0.0.1', // FR-017: bind APENAS em localhost
    corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    supportedSchemaVersions: resolveSchemaVersions(),
  };
}
