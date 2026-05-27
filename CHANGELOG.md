# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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

[0.1.1]: https://github.com/JotJunior/cstk-panel/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JotJunior/cstk-panel/releases/tag/v0.1.0
