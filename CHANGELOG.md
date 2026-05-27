# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.2.1] - 2026-05-27

### Corrigido

#### Backend (`@cstk-panel/server`)
- O front-end quebrava por inteiro (`invalid_enum_value` na validação Zod) quando
  a `knowledge.db` continha um status fora do contrato — ex.: `concluido` em vez
  de `concluida`. Como o `status` é parcialmente escrito por um LLM
  (orquestrador), variantes assim podem ocorrer. As rotas de _rollup_
  (features/projects/overview) emitiam `latestStatus` **cru**, derrubando a lista
  inteira (violando o Invariante II — _degradação nunca quebra_).
- Novo normalizador `normalizeStatus` (fonte única) no limite de leitura:
  remapeia _aliases_ conhecidos (`concluido`→`concluida`, `abortado`→`abortada`)
  e degrada qualquer valor desconhecido para `null` — o servidor nunca mais
  emite um enum inválido. `mapExecution` passou a reutilizá-lo (sem duplicação).
  O filtro de `GET /features?status=` também normaliza, de modo que filtrar por
  `concluida` captura linhas cujo valor cru é uma variante conhecida.

## [0.2.0] - 2026-05-27

### Adicionado

#### Backend (`@cstk-panel/server`)
- `npm run start` agora sobe **API + front-end** num único processo e porta: o
  servidor Fastify serve o SPA buildado (`apps/web/dist`) via `@fastify/static`,
  além dos endpoints `GET /api/v1`. Antes o `start` subia apenas a API e a raiz
  devolvia o envelope JSON 404 — por isso o `cstk serve` precisava recorrer ao
  `npm run dev` (Vite + proxy em duas portas). Diretório do front-end
  configurável via `CSTK_WEB_DIR` (default: `apps/web/dist`).

### Modificado

#### Backend (`@cstk-panel/server`)
- O header `Content-Type: application/json` passou a ser **escopado às rotas
  `/api/v1`**. O hook global de resposta mantém apenas os headers de segurança
  (`X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control`), evitando
  corromper o `Content-Type` de HTML/CSS/JS servidos estaticamente.
- `notFoundHandler`: rotas `/api/*` continuam retornando 404 JSON estruturado;
  demais paths caem em _fallback_ SPA (`index.html`) quando o front-end está
  habilitado, para o `HashRouter` resolver a rota no cliente.
- Degradação graciosa (Invariante II): se o build do web estiver ausente, o
  servidor sobe **apenas a API** e registra um aviso — nunca falha o boot.

## [0.1.2] - 2026-05-27

### Modificado

#### Tooling e dependências
- Migração do ESLint 8 → 9 com _flat config_ (`eslint.config.mjs`, substituindo
  `.eslintrc.cjs`), trocando `@typescript-eslint/{eslint-plugin,parser}` v7 pelo
  pacote unificado `typescript-eslint` v8. As regras constitucionais permanecem
  idênticas (proibição de `innerHTML`/`dangerouslySetInnerHTML`, `no-unused-vars`,
  `no-explicit-any`).
- Removida a flag `--ext .ts,.tsx` dos scripts de _lint_ (não suportada em _flat
  config_; o casamento de arquivos passa a ser definido na própria config).
- Eliminados **6 dos 7** _warnings_ de dependência depreciada na instalação
  (`inflight`, `glob@7`, `rimraf@3`, `@humanwhocodes/config-array`,
  `@humanwhocodes/object-schema`, `eslint@8`), todos provenientes da cadeia do
  ESLint 8. O _warning_ remanescente (`prebuild-install`) vem de `better-sqlite3`
  e não tem correção por versão — persiste até no _release_ mais recente da lib.

### Removido

#### Frontend (`@cstk-panel/web`)
- Diretiva `eslint-disable` obsoleta em `api.ts` (`no-unsafe-return` nunca esteve
  ativa; o ESLint 9 passou a sinalizá-la).

## [0.1.1] - 2026-05-27

### Corrigido

#### Frontend (`@cstk-panel/web`)
- Barras do _pipeline_ ficavam totalmente cinzas para execuções concluídas: o
  orquestrador grava `etapa_corrente='concluida'` (marcador terminal, fora de
  `SDD_STAGES`), e os renderizadores _inline_ preenchiam segmentos apenas com
  `i <= idx` — com `idx=-1` nenhuma barra era pintada.
- Corrigidas `keys` de React no `DecisionsPanel` (uso de `Fragment` com `key`).

### Modificado

#### Frontend (`@cstk-panel/web`)
- Renderização do _pipeline_ consolidada no componente compartilhado
  `PipelineProgress` (_single source of truth_ para a lógica de etapas
  done/current/aborted), eliminando cópias duplicadas em `Executions` e
  `ExecutionDetail`. As telas agora usam coloração por etapa, consistente com
  Overview/Features.

## [0.1.0] - 2026-05-26

Primeira versão do **cstk-panel** — dashboard de observabilidade _read-only_ para
execuções dos orquestradores `agente-00c` / `feature-00c`, lido diretamente da
`~/.claude/cstk/knowledge.db`.

### Adicionado

#### Backend (`@cstk-panel/server`)
- Servidor HTTP _read-only_ sobre a `knowledge.db` expondo 29 endpoints `GET`.
- Abertura do banco em modo somente-leitura (`readonly: true` + `pragma query_only = 1`),
  com _retry_ tolerante a _torn read_ transitório.
- Envelope de resposta padrão `{ data, meta: { degraded, reason, freshness, schema_version } }`.
- Degradação graciosa (Invariante II): nenhum caminho lança exceção — falhas retornam
  `{ ok: false }` com motivo.
- Frescor de _snapshot_ via `freshness` + `ETag` em todas as rotas.
- Suporte ao schema v3 da `knowledge.db` (campos `titulo` e `recall_consulted`).
- Sanitização de _payload_ FTS5 contra _queries_ hostis.

#### Tipos compartilhados (`@cstk-panel/shared-types`)
- DTOs centralizados com schemas Zod correspondentes e testes de paridade _round-trip_
  (payloads sintéticos e reais da API).

#### Frontend (`@cstk-panel/web`)
- SPA React 19 com `HashRouter` e TanStack Query.
- Telas Overview, Projetos, Features, Tarefas e Incidentes (visões _cross-execução_).
- Conteúdo UNTRUSTED renderizado via `<TextRaw>` — sem `dangerouslySetInnerHTML` (Invariante V).
- Custo exibido apenas como `tool calls` (proxy honesto, sem `$`/USD/tokens — Invariante III).
- Identidade visual alinhada ao protótipo (logo e mix de modelos).

#### Qualidade e governança
- 189 testes automatizados (shared-types + integração E2E do servidor).
- Invariantes constitucionais I–VI verificáveis por scripts de _lint_.
- `npm run lint:readonly-check` garante zero verbos de mutação SQL em `apps/server/src`.

[0.2.1]: https://github.com/JotJunior/cstk-panel/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/JotJunior/cstk-panel/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/JotJunior/cstk-panel/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JotJunior/cstk-panel/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JotJunior/cstk-panel/releases/tag/v0.1.0
