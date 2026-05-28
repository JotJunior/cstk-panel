# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.6.0] - 2026-05-28

### Adicionado

#### Tema claro + alternância de tema
- Novo **tema claro** além do tema escuro existente, alternável pelo botão de
  sol/lua no rodapé da sidebar. A preferência persiste em `localStorage`
  (`cstk-theme`) e é aplicada **antes do primeiro paint** por um script inline
  anti-FOUC no `index.html` (sem flash do tema na carga). Sem preferência salva,
  cai em `prefers-color-scheme` (`try/catch` → fallback `dark` se `localStorage`
  estiver bloqueado).
- Paleta de superfícies, bordas e texto dedicada ao tema claro. As cores
  semânticas (`success`/`warning`/`critical`/`info`/`inprogress`/`score-*`) e o
  dourado de marca (`accent`) são recalibrados sob `[data-theme="light"]` para
  atender **contraste WCAG AA** sobre fundos claros (auditoria: 0 falhas AA nas
  10 telas). O tema escuro permanece inalterado (overrides escopados).

#### Sidebar retrátil
- A sidebar agora **recolhe para um modo fino (52px)** exibindo apenas os ícones,
  com transição suave. O estado persiste em `localStorage`
  (`cstk-sidebar-collapsed`). No modo recolhido: cada item exibe **tooltip** (CSS
  puro) no hover, o indicador âmbar do item ativo continua visível, e o rodapé
  reduz ao botão de tema. A área de conteúdo se expande automaticamente via
  `:has()` (sem prop-drilling).
- Botão recolher/expandir acessível — `aria-label`/`aria-expanded` dinâmicos e
  ativação por teclado (Enter/Space) com retorno de foco.

### Corrigido
- **Sidebar — ativação por teclado:** o botão de recolher (`<button>` nativo)
  tinha um `onKeyDown` redundante que fazia Enter/Space dispararem o toggle duas
  vezes (cancelando-se). Handler removido; teclado volta a funcionar (WCAG 2.1.1).
- **Métricas — card "Decisões por score":** decisões com `score` nulo (linha do
  `GROUP BY score` com `score=null`) colidiam a `key` do React com o score 0 e
  eram rotuladas erroneamente como "0". O bucket sem-score agora usa key estável,
  exibe "—" e cor neutra.

## [0.5.0] - 2026-05-28

### Adicionado

#### Opções consideradas nas decisões (schema v6)
- A aba **Decisões** do detalhe da execução agora exibe, na linha expandida, as
  **opções consideradas** antes da escolha — uma lista de chips em que a opção
  escolhida aparece destacada (cor de acento + ✓). Espelha a coluna
  `decisions.opcoes` introduzida no **schema v6** da `knowledge.db`
  (JSON array cru de `state.json.decisoes[].opcoes_consideradas`). Antes só era
  possível ver a escolha e a justificativa; agora dá para auditar o leque de
  alternativas que a IA avaliou. **Read-only** — a fonte canônica é o `state.json`.

#### Backend (`@cstk-panel/server`)
- `config`/`open` passam a aceitar `schema_version='6'` (mantendo v2..v5). O
  default de `CSTK_SCHEMA_VERSIONS` agora é `2,3,4,5,6`.
- `db/queries/decisions` projeta `opcoes` de forma tolerante a schema
  (Princípio II): bases v<6 sem a coluna **degradam para `opcoes=null`** via
  `hasColumn` (`NULL as opcoes`), sem quebrar o `SELECT`. O valor é estruturado
  (JSON cru, sem scrub) e repassado intacto pelo mapper. Continua só `SELECT`
  (passa no `lint:readonly-check`).

#### Tipos compartilhados (`@cstk-panel/shared-types`)
- `DecisionDTO`/`DecisionDTOSchema` ganham `opcoes: string | null`.

#### Frontend (`@cstk-panel/web`)
- Novo helper `lib/decision-options` (`decisionOptions` reaproveita o parser
  defensivo de `stack-display`; `chosenOptionIndex` faz match best-effort da
  escolha contra as opções — exato, prefixo de namespace como `model:sonnet`, ou
  elaboração por prefixo com fronteira de token — destacando **no máximo uma**
  opção, para não marcar a alternativa errada). Conteúdo renderizado via
  `textContent` (nunca `innerHTML`).

## [0.4.0] - 2026-05-28

### Adicionado

#### Aba "Sugestões" no detalhe da execução (schema v5)
- Nova aba **Sugestões** no detalhe da execução (ao lado de Decisões, Tarefas,
  Eventos, Alertas e Bloqueios) que exibe a tabela `suggestions` introduzida no
  **schema v5** da `knowledge.db` (feature `recall-suggestions` do cstk):
  espelho de `state.json.sugestoes[]` — as melhorias que a IA propõe a alguma
  skill durante a orquestração (`diagnóstico`, `proposta`, `referencias`,
  `severidade` ∈ `informativa|aviso|impeditiva`, `skill_afetada`,
  `issue_aberta`). Escopo por execução; chave natural `(execucao_id, source_id)`.
  **Read-only** — o painel apenas exibe; a fonte canônica é o `state.json`.

#### Backend (`@cstk-panel/server`)
- `config`/`open` passam a aceitar `schema_version='5'` (mantendo v2/v3/v4). O
  default de `CSTK_SCHEMA_VERSIONS` agora é `2,3,4,5`.
- Novo `GET /executions/:execucaoId/suggestions` (`db/queries/suggestions` +
  `mappers/suggestion`): apenas `SELECT` (passa no `lint:readonly-check`).
  Tolerante a schema (Princípio II) — bases v<5 sem a tabela `suggestions`
  **degradam para lista vazia** via `hasTable`, em vez de quebrar (`degraded=false`).
  O mapper divide `referencias` (CSV) em array, coage `severidade` desconhecida
  para `null` e normaliza `''`→`null`. `diagnóstico`/`proposta`/`referencias`
  viajam crus (UNTRUSTED — defesa de XSS é do front-end).

#### Tipos compartilhados (`@cstk-panel/shared-types`)
- `SuggestionDTO` + `SuggestionDTOSchema` (Zod): `severidade` como enum
  `informativa|aviso|impeditiva` (nullable); `diagnóstico`/`proposta`/
  `referencias` marcados `@untrusted`; `referencias` como `string[]`.

#### Front-end (`@cstk-panel/web`)
- `useSuggestions(execucaoId)` (TanStack Query) + `SuggestionListSchema`.
- `SuggestionsPanel`: cartões com badge de severidade (cor por nível), skill
  afetada, diagnóstico/proposta e chips de referências. Todo campo livre é
  renderizado via `TextRaw` (textContent — Princípio V, nunca `innerHTML`).
  Estado vazio explica também o caso de base em schema < v5.

#### Testes
- `apps/server/test/lib/suggestions.test.ts`: base v5 mínima (listagem em ordem
  cronológica, split de `referencias`, severidade conhecida, `issue_aberta`,
  conteúdo UNTRUSTED cru) + base v3 sem a tabela (degradação para `[]` sem
  `degraded`).

## [0.3.1] - 2026-05-27

### Corrigido

#### Front-end (`@cstk-panel/web`)
- **Stack sugerida renderizada como fragmentos quebrados** nas telas de execução
  e de feature. O agente-00c grava `executions.stack_sugerida` como **JSON** —
  ora array de strings (`["react 19","vite","nodejs"]`), ora objeto chave/valor
  (`{"language":"TypeScript 5.4",…}`) — mas `ExecutionDetail` e `FeatureDetail`
  faziam `split(',')`, tratando-o como CSV. Um objeto JSON estilhaçava em chips
  inúteis (`{ "language": …`, `"runtime": …`, … `… }`) e arrays carregavam `[`,
  `"` e `]` literais.
- Novo helper **defensivo** `stackDisplayItems` (`lib/stack-display`): array →
  um chip por item; objeto → chips `chave: valor`; _fallback_ para CSV no
  formato legado; JSON malformado não lança. O painel segue **read-only** — a
  normalização ocorre apenas na exibição (mesmo princípio de `memory-display`),
  sem reescrever a base. Inclui 8 testes unitários.

## [0.3.0] - 2026-05-27

### Adicionado

#### Tela "Memórias" (auto-memórias do Claude Code, schema v4)
- Nova tela **Memórias** que exibe a tabela `memories` introduzida no **schema
  v4** da `knowledge.db` (feature `recall-memory-mirror` do cstk/claude-ai-tips):
  espelho dos arquivos `.md` de auto-memória que o harness persiste por projeto.
  **Read-only e best-effort** — o painel apenas exibe; a fonte canônica são os
  `.md` no disco. Filtro por projeto (server-side) ou exibição de todas, além de
  filtro por tipo e busca textual (client-side). O corpo do `.md` é expansível,
  renderizado via `children` do React (textContent — Princípio V, nunca
  `innerHTML`).

#### Backend (`@cstk-panel/server`)
- `config`/`open` passam a aceitar `schema_version='4'` (mantendo v2/v3). O
  default de `CSTK_SCHEMA_VERSIONS` agora é `2,3,4`.
- Novo `hasTable()` (cacheado por conexão) em `db/columns`: bases v2/v3 sem a
  tabela `memories` **degradam para lista vazia** em vez de quebrar (Princípio
  II) — ausência da feature não é defeito da base, então `degraded=false`.
- Novo `GET /memories?project=` (`db/queries/memories` + `routes/memories`):
  apenas `SELECT` (passa no `lint:readonly-check`). Retorna as memórias
  paginadas, a **lista completa de projetos** para o seletor (independente do
  filtro corrente) e metadados de paginação. `description`/`body` viajam crus
  (UNTRUSTED — defesa de XSS é do front-end).
- `GET /health` passa a contar a tabela `memories`.

#### Tipos compartilhados (`@cstk-panel/shared-types`)
- `MemoryDTO` + `MemoryDTOSchema` (Zod): `type` como enum
  `index|feedback|project|reference|user`; `description`/`body` marcados
  `@untrusted`.

#### Front-end (`@cstk-panel/web`)
- `useMemories(project)` (TanStack Query) + `MemoriesPageSchema`.
- `memory-display`: derivação **defensiva** do rótulo de descrição. O produtor
  define `description` como a 1ª linha não-vazia do `.md`; como os `.md` começam
  com frontmatter YAML, isso captura o delimitador `---` na maioria dos casos
  (~86% da base real observada). No display (sem reescrever o índice) caímos para
  o campo `description:` do frontmatter, depois 1ª linha de prosa, depois slug
  humanizado.
- Item **Memórias** na Sidebar + rota `/memories`; a tela **Fonte de dados**
  lista a tabela `memories`. O rodapé da Sidebar e o Source passam a refletir o
  `schema_version` **real** (antes fixo em "v2").

### Testes / Infra
- Rota `/memories` com base v4 real construída em tmpdir (listagem, filtro por
  projeto, `projects` completo, `body` UNTRUSTED cru, projeto inexistente) +
  degradação graciosa em base v3 (sem a tabela). Unit de `memory-display`
  cobrindo o caso `description='---'` e os fallbacks. Suíte: **218 testes**.

## [0.2.2] - 2026-05-27

### Corrigido

#### Front-end (`@cstk-panel/web`)
- A visão da execução (`ExecutionDetail`) exibia o pipeline com **todas as
  etapas apagadas** para execuções concluídas. Execuções terminais gravam
  `etapa_corrente='concluida'` — marcador fora de `SDD_STAGES` (`idx=-1`) — e o
  modo rotulado do `PipelineProgress` acendia por `i < idx`, deixando tudo
  cinza. Mesmo defeito já corrigido na listagem (modo compacto), agora
  replicado na visão de detalhe.
- A classificação das etapas foi extraída para `stageStates()` (função pura,
  fonte única consumida pelos dois modos de render): a decisão acende pelo
  **status** — já normalizado no servidor (`concluido`→`concluida`) — e não
  pelo índice da etapa. Concluída acende todas; abortada marca da etapa
  corrente em diante.
- Adicionado o estilo `.pipeline-labeled .stage.aborted` (a variante rotulada
  não possuía, ao contrário da compacta), para paridade de renderização.

### Testes / Infra
- Novo teste de `stageStates` cobrindo `concluida`/`abortada` com `idx=-1`,
  `em_andamento`, `aguardando_humano` e `null`.
- Registrado o alias `@` na config Vitest raiz para que a suíte de componentes
  resolva `@/lib/...` (antes só existia no `vite.config` do web).

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

[0.6.0]: https://github.com/JotJunior/cstk-panel/compare/v0.5.0...v0.6.0
[0.3.1]: https://github.com/JotJunior/cstk-panel/compare/v0.3.0...v0.3.1
[0.2.1]: https://github.com/JotJunior/cstk-panel/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/JotJunior/cstk-panel/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/JotJunior/cstk-panel/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JotJunior/cstk-panel/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JotJunior/cstk-panel/releases/tag/v0.1.0
