/**
 * Configuracao do servidor — resolucao do path do banco.
 * Ref: plan.md §Project Structure; spec.md FR-018
 *
 * Ordem de resolucao (FR-018):
 * 1. Variavel de ambiente CSTK_KNOWLEDGE_DB (config explicita)
 * 2. Default: ~/.claude/cstk/knowledge.db
 *
 * O path e canonicalizado via path.resolve para evitar path traversal.
 */
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export interface ServerConfig {
  /** Path absoluto canonicalizado para knowledge.db */
  dbPath: string;
  /** Porta do servidor HTTP (bind em localhost) */
  port: number;
  /** Host — SEMPRE 127.0.0.1 (FR-017: localhost bind) */
  host: string;
  /** Origem permitida para CORS */
  corsOrigin: string;
}

function resolveDbPath(): string {
  const fromEnv = process.env['CSTK_KNOWLEDGE_DB'];
  if (fromEnv && fromEnv.trim() !== '') {
    return resolve(fromEnv.trim());
  }
  return resolve(homedir(), '.claude', 'cstk', 'knowledge.db');
}

export function loadConfig(): ServerConfig {
  return {
    dbPath: resolveDbPath(),
    port: parseInt(process.env['PORT'] ?? '3001', 10),
    host: '127.0.0.1', // FR-017: bind APENAS em localhost
    corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  };
}
