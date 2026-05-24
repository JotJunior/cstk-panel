# cstk-panel — Dashboard de Observabilidade Read-Only

Dashboard de observabilidade sobre as execucoes dos orquestradores `agente-00c` / `feature-00c`.
Le diretamente da `knowledge.db` (SQLite + FTS5, schema v2) — **nao escreve, nao muta, nao reconstroi o indice**.

## Pre-requisitos

- Node.js >= 20 LTS
- npm >= 10
- `~/.claude/cstk/knowledge.db` (gerado por `cstk recall --ingest` em execucoes de agente-00c/feature-00c)

## Setup

```bash
# 1. Instalar dependencias (todos os workspaces)
npm install

# 2. Iniciar em modo desenvolvimento (server + web, hot-reload)
npm run dev
```

O servidor sobe em `http://localhost:3001` e o front-end em `http://localhost:5173`.

## Build de producao

```bash
# Compila shared-types -> server -> web (ordem de dependencias)
npm run build

# Iniciar o servidor de API em modo producao
npm start
# Equivalent a: node apps/server/dist/index.js

# O front-end buildado fica em apps/web/dist/ (servir com qualquer static server)
# Exemplo: npx serve apps/web/dist -p 4000
```

## Variaveis de ambiente

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| `CSTK_KNOWLEDGE_DB` | `~/.claude/cstk/knowledge.db` | Path absoluto para a base SQLite de conhecimento |
| `PORT` | `3001` | Porta do servidor de API (bind em 127.0.0.1) |
| `CORS_ORIGIN` | `http://localhost:5173` | Origem permitida pelo CORS do servidor |
| `LOG_LEVEL` | `info` | Nivel de log do Fastify (`trace`/`debug`/`info`/`warn`/`error`) |

Exemplo apontando para base alternativa:

```bash
CSTK_KNOWLEDGE_DB=/path/to/knowledge.db PORT=4001 npm start
```

## Estrutura do monorepo

```
cstk-panel/
├── apps/
│   ├── server/          # Back-end Fastify 5 + better-sqlite3 (read-only)
│   │   ├── src/         # TypeScript — rotas, queries, mappers, config
│   │   └── test/        # Testes de integracao Vitest (base fixture real)
│   └── web/             # Front-end React 19 + Vite 5
│       └── src/         # Telas, componentes, hooks, estados transversais
└── packages/
    └── shared-types/    # DTOs, envelope padrao, schemas Zod (BE<->FE)
        └── src/         # Tipos e schemas compartilhados
```

## Scripts

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia server e web em paralelo (hot-reload) |
| `npm run build` | Build de producao (shared-types -> server -> web) |
| `npm start` | Inicia o servidor de API em producao (`node apps/server/dist/index.js`) |
| `npm test` | Executa suite completa de testes Vitest (161 testes) |
| `npm run lint` | ESLint em todos os workspaces |
| `npm run lint:readonly-check` | Confirma ausencia de verbos SQL de mutacao no server (SC-003) |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |

## Testes

O projeto tem 161 testes organizados em dois grupos:

- **Testes de integracao do servidor** (109 testes em `apps/server/test/`):
  - `server-health.test.ts` — saude e headers obrigatorios
  - `open.test.ts` — abertura de DB e 4 motivos de degradacao
  - `freshness.test.ts` — frescor de snapshot e ETag
  - `roundtrip.test.ts` — payload real ponta-a-ponta
  - `routes.test.ts` — todos os 29 endpoints GET
  - `degradation.test.ts` — 5 endpoints em 3 cenarios de degradacao
  - `readonly.test.ts` — ausencia de mutacao + payload hostil FTS5
  - `fts.test.ts` — sanitizacao de FTS5 (payloads hostis)
  - `mappers.test.ts` — conversao snake_case->camelCase, lintOk, score

- **Testes de paridade de tipos** (52 testes em `packages/shared-types/`):
  - `envelope.test.ts` — schemas Zod do envelope padrao
  - `parity.test.ts` — schemas Zod para cada DTO (sintetico)
  - `parity-real.test.ts` — schemas Zod com payloads reais da API

```bash
# Rodar todos os testes
npm test

# Rodar apenas testes do servidor (com base fixture real)
cd apps/server && npx vitest run

# Rodar apenas testes de tipos compartilhados
cd packages/shared-types && npx vitest run
```

## Principios constitucionais

1. **Read-Only Absoluto (NON-NEGOTIABLE)** — conexao com `readonly: true` + `PRAGMA query_only = 1`; zero verbos de mutacao SQL
2. **Degradar, Nunca Quebrar** — base ausente/corrompida/schema-divergente retorna `meta.degraded=true`, nunca 5xx
3. **Honestidade de Metrica** — custo = `toolCalls` (proxy); zero rotulos `$`/USD/token
4. **Nao Reimplementar** — arvore de decisoes delega a `skill decision-tree`; `cstk panel` e gancho futuro
5. **Conteudo UNTRUSTED** — campos de agente renderizados via `<TextRaw>` (textContent), nunca `dangerouslySetInnerHTML`
6. **Snapshot que Muda** — `freshness` em todo envelope (mtime + max ingested_at); ETag invalida cache ao trocar base

## Gancho futuro: `cstk panel serve`

O subcomando `cstk panel serve` esta planejado como evolucao futura do CLI `cstk`. Quando implementado, sera equivalente a iniciar este servidor com a configuracao padrao (`~/.claude/cstk/knowledge.db`). O monorepo standalone e o MVP; a integracao via CLI e aditiva e nao bloqueante (research.md Decision 4).
