# cstk-panel — Dashboard de Observabilidade Read-Only

Dashboard de observabilidade sobre as execucoes dos orquestradores `agente-00c` / `feature-00c`.
Le diretamente da `knowledge.db` (SQLite + FTS5, schema v2) — **nao escreve, nao muta, nao reconstroi o indice**.

## Requisitos

- Node.js >= 20 LTS
- npm >= 10

## Setup

```bash
# 1. Instalar dependencias (todos os workspaces)
npm install

# 2. Iniciar em modo desenvolvimento (server + web, hot-reload)
npm run dev
```

O servidor sobe em `http://localhost:3001` e o front-end em `http://localhost:5173`.

## Estrutura do monorepo

```
cstk-panel/
├── apps/
│   ├── server/          # Back-end Fastify 5 + better-sqlite3 (read-only)
│   └── web/             # Front-end React 19 + Vite 5
└── packages/
    └── shared-types/    # DTOs, envelope padrao, schemas Zod (BE<->FE)
```

## Scripts

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia todos os workspaces em modo dev |
| `npm run build` | Build de producao de todos os workspaces |
| `npm run test` | Executa suite de testes (Vitest) |
| `npm run lint` | ESLint em todos os workspaces |
| `npm run lint:readonly-check` | Garante ausencia de verbos SQL de mutacao no server |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |

## Configuracao do banco

Por padrao, usa `~/.claude/cstk/knowledge.db`. Para apontar para outro arquivo:

```bash
CSTK_KNOWLEDGE_DB=/path/to/custom/knowledge.db npm run dev
```

## Principios constitucionais

1. **Read-Only Absoluto (NON-NEGOTIABLE)** — nenhuma escrita no banco
2. **Degradar, Nunca Quebrar** — ausencia/corrupcao do DB retorna estado degradado
3. **Honestidade de Metrica** — custo = `tool_calls` (proxy); zero USD/token
4. **Nao Reimplementar o que Tem Dono** — arvore de decisoes delega a skill decision-tree
5. **Conteudo de Agente e UNTRUSTED** — renderizado via textContent, nunca innerHTML
6. **Snapshot que Muda** — freshness em todo envelope; ETag derivado de mtime + max(ingested_at)
