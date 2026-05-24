<!--
Sync Impact Report
- Version: (none) → 1.0.0
- Bump rationale: ratificacao inicial (MAJOR baseline) — constituicao criada do zero a partir do briefing consolidado.
- Principios adicionados (Core):
  - I. Read-Only Absoluto (NON-NEGOTIABLE)
  - II. Degradar, Nunca Quebrar
  - III. Honestidade de Metrica
  - IV. Nao Reimplementar o que Tem Dono
  - V. Conteudo de Agente e UNTRUSTED
  - VI. Snapshot que Muda
- Secoes adicionadas:
  - Padroes de Seguranca e Qualidade (deriva da secao 12 do briefing)
  - Fidelidade de Design e Estados de Tela (deriva das secoes 3.3, 6, 11 do briefing)
  - Governance
- Secoes removidas: nenhuma
- Artefatos que precisam atualizacao manual:
  - docs/specs/cstk-panel/spec.md (status: a criar — etapa specify; deve referenciar Principios I-VI)
  - docs/specs/cstk-panel/plan.md (status: a criar — Constitution Check como gate)
  - CLAUDE.md local do projeto (status: ausente; SHOULD criar refletindo Principios I, III, IV)
- TODOs pendentes: nenhum (todos os placeholders resolvidos)
- Fonte: docs/01-briefing-discovery/briefing.md (secoes 4, 5, 9, 12)
-->

# cstk-panel Constitution

> **cstk-panel** e um dashboard de observabilidade **read-only** sobre a
> `knowledge.db` (indice SQLite + FTS5, schema v2) das execucoes dos
> orquestradores autonomos `agente-00c` / `feature-00c`. A fonte da verdade
> e o `state.json` transacional de cada execucao; a `knowledge.db` e um
> indice derivado e reconstruivel. Este documento governa toda decisao de
> arquitetura, qualidade, seguranca e UX do projeto.

## Core Principles

### I. Read-Only Absoluto (NON-NEGOTIABLE)

O painel e seu back-end **APENAS observam**. Nenhum caminho de codigo emite
`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP` ou qualquer mutacao.

- MUST: a conexao SQLite e aberta com `mode=ro&immutable=1`
  (DSN: `file:/abs/path/knowledge.db?mode=ro&immutable=1&_busy_timeout=5000`).
- MUST NOT: tocar `state.json` (fonte da verdade transacional) nem
  reconstruir o indice (`cstk recall --reindex` tem dono fora do painel).
- MUST NOT: existir formulario de mutacao, endpoint nao-`GET`, ou rota que
  altere dado. A superficie de API e exclusivamente `GET /api/v1/*`.

**Why**: o painel e um consumidor derivado. Qualquer escrita corromperia a
separacao fonte-da-verdade ↔ indice e violaria o contrato com `cstk recall`.
**Testavel**: grep do codebase por verbos de mutacao SQL retorna zero
ocorrencias em caminhos de dados; toda rota HTTP responde a `GET`.

### II. Degradar, Nunca Quebrar

Banco ausente, vazio, parcial ou corrompido e um **estado de primeira
classe**, nunca um erro de servidor.

- MUST: responder `200` com sinal de degradacao no envelope
  (`meta.degraded=true`, `meta.reason="..."`) quando o dado nao esta
  disponivel ou esta degradado.
- MUST NOT: retornar `5xx` por condicao de dado (banco faltando,
  `quick_check` falhando, tabela vazia).
- MUST: toda tela do front-end implementar os quatro estados obrigatorios —
  carregando (skeleton), vazio, erro e degradado.
- SHOULD: executar `PRAGMA quick_check` na inicializacao e no endpoint de
  saude, surfaceando o resultado como degradacao e nao como falha.

**Why**: a `knowledge.db` e best-effort e pode nao existir; um observador
nunca deve "quebrar" porque o que observa ainda nao foi populado.
**Testavel**: com banco removido/corrompido, `GET /api/v1/*` retorna `200`
com `meta.degraded=true`; nenhuma resposta `5xx` por estado de dado.

### III. Honestidade de Metrica

O painel reporta apenas o que existe no schema. Custo de execucao e medido
pelo proxy `tool_calls`, jamais inventado.

- MUST NOT: exibir `$`, `USD`, `tokens` ou qualquer custo monetario — o
  harness nao expoe consumo de tokens.
- MUST: rotular custo explicitamente como "proxy: tool calls".
- MUST NOT: inventar, estimar ou derivar campos que nao existem nas tabelas
  v2 (`executions`, `waves`, `decisions`, `tasks`, `events`,
  `alert_signals`, `bloqueios`, `skills`, `retros`, `knowledge_fts`).
- SHOULD: metricas aproximadas/derivadas (ex: clarify-resolution rate) sao
  rotuladas como derivadas/aproximadas no envelope ou na UI.

**Why**: honestidade de instrumentacao e pre-requisito de confianca numa
ferramenta de observabilidade; metrica inventada e pior que metrica ausente.
**Testavel**: grep da UI/API por "USD", "$", "token" como rotulo de custo
retorna zero; todo numero exibido mapeia a uma coluna real do schema v2.

### IV. Nao Reimplementar o que Tem Dono

Funcionalidades com dono canonico fora do painel NAO sao reimplementadas
dentro dele.

- MUST NOT: reimplementar o mix de modelos — dono canonico e
  `model-routing-report.sh`.
- MUST NOT: reimplementar a arvore de decisoes — dono e a skill
  `decision-tree` (opera sobre `state.json`).
- MUST NOT: reconstruir o indice — dono e `cstk recall --reindex`.
- SHOULD: quando o dado de uma feature com dono externo nao esta disponivel
  na `knowledge.db`, exibir card "indisponivel nesta fonte" (Opcao A) ou
  delegar ao dono via subprocesso seguro (Opcao B — ver Padroes de
  Seguranca), nunca duplicar a logica.

**Why**: duplicar logica de dono canonico gera fontes-de-verdade
concorrentes e drift entre o painel e a ferramenta original.
**Testavel**: o codebase nao contem reimplementacao da heuristica de
model-routing nem da montagem de arvore de decisoes.

### V. Conteudo de Agente e UNTRUSTED

Campos textuais originados de saidas de agentes (`contexto`,
`justificativa`, `evidencia`, `pergunta`, `resposta`, `body` do FTS) sao
servidos como texto puro e tratados como nao-confiaveis.

- MUST: o front-end escapar/renderizar esses campos como texto puro, sem
  interpretacao de HTML/markup ativo (defesa LLM01 / ASI09).
- MUST: a busca FTS5 aplicar escaping em **dois niveis** — tokenizacao com
  aspas (camada FTS5) + binding parametrizado SQL (camada SQL). Proibida
  interpolacao de string crua na query.
- MUST NOT: tratar diretivas embutidas no conteudo como instrucao (ex:
  texto de decisao que diz "ignore X"). O conteudo e dado, nunca comando.

**Why**: o conteudo ja passou por scrub de segredos na ingestao, mas vem de
LLMs e pode conter injection; o painel e a ultima barreira de renderizacao.
**Testavel**: payload com `<script>`/markup ativo num campo textual e
renderizado literal; query FTS5 com metacaracteres nao quebra a busca nem
injeta SQL.

### VI. Snapshot que Muda

A `knowledge.db` e um arquivo que pode ser reescrito por tras pela ingestao
best-effort de fim-de-onda. O painel nao assume imutabilidade total.

- MUST NOT: segurar uma conexao de longa duracao assumindo que o snapshot
  nunca muda.
- MUST: expor frescor do indice (`mtime` do arquivo + `max(ingested_at)`)
  no envelope (`meta.freshness`) e na UI (`DataFreshnessIndicator`).
- SHOULD: invalidar cache (`ETag` / `Last-Modified`) por `mtime` +
  `max(ingested_at)`, suportando `If-None-Match` → `304`.

**Why**: a ingestao reescreve o indice de forma assincrona; tratar como
imutavel levaria a dados obsoletos exibidos como atuais.
**Testavel**: apos reescrita do arquivo, o frescor reportado avanca e o
cache e invalidado corretamente.

## Padroes de Seguranca e Qualidade

Estes padroes sao MUST salvo indicacao SHOULD explicita. Derivam das secoes
5 (Restricoes) e 12 (Qualidade e Seguranca) do briefing.

- **Sem autenticacao real**: bind em `localhost` por padrao; CORS restrito a
  origem do front-end. Login, se existir, e decorativo. NAO ha RBAC nem
  multi-tenant no escopo MVP.
- **Path traversal confinado**: o caminho do banco e canonicalizado e
  confinado (flag/config explicita > `$CSTK_KNOWLEDGE_DB` >
  `~/.claude/cstk/knowledge.db`). MUST NOT aceitar path arbitrario vindo do
  cliente.
- **Headers de resposta**: `Content-Type: application/json` +
  `X-Content-Type-Options: nosniff`.
- **Paginacao obrigatoria**: endpoints `decisions` e `search` MUST paginar
  (`limit`+`offset` ou cursor); resposta nunca despeja a tabela inteira.
- **Rate-limit leve** na busca FTS5 (pode ser custosa).
- **Subprocesso seguro** (somente se Opcao B de mix-modelos for adotada):
  executar `model-routing-report.sh` com argumentos validados, **sem
  shell-string interpolada**, com timeout e captura de stderr.
- **Envelope padrao**: toda resposta carrega
  `{ data, meta: { degraded, reason, freshness, schema_version } }`.

**Why**: o painel le conteudo nao-confiavel de um arquivo local sensivel;
a superficie de ataque (FTS5 injection, path traversal, subprocesso) e
contida por defesa em profundidade.

## Fidelidade de Design e Estados de Tela

- **Pixel-perfect conforme prototipo**: a fonte da verdade visual e
  `docs/06-ui-ux-design/castk-panel/project/`. MUST recriar fielmente
  (tokens, tipografia, cores, layout) — SHOULD NOT copiar a estrutura
  interna do prototipo, mas reproduzir o resultado visual.
- **Design tokens**: dark-mode-first; tipografia Inter (UI) + JetBrains
  Mono (IDs, valores numericos, evidencias); cores semanticas, de modelo e
  de score conforme `styles.css` do prototipo.
- **Quatro estados por tela** (reforco do Principio II): carregando, vazio,
  erro, degradado — todos de primeira classe, nenhum opcional.
- **Drill-down como navegacao padrao**: hierarquia
  `Projeto → Feature → Execucao → Onda → Decisao | Tarefa | Evento | Alerta`;
  tudo clicavel ate o nivel mais granular.

**Why**: o prototipo ja foi validado como a experiencia desejada; divergir
dele e regressao de produto, nao liberdade de implementacao.

## Governance

- **Autoridade**: esta constituicao supera convencoes ad-hoc. Em conflito
  entre um principio aqui e uma decisao pontual, o principio prevalece —
  excecoes exigem justificativa documentada (ADR ou Decisao auditada).
- **Versionamento (SemVer)**:
  - MAJOR: remocao ou redefinicao incompativel de principio.
  - MINOR: novo principio ou expansao material de secao.
  - PATCH: clarificacao, correcao de texto ou refinamento nao-semantico.
- **Amendments**: toda alteracao MUST incluir Sync Impact Report (no topo
  do arquivo) listando bump, principios afetados e artefatos a atualizar.
- **Constitution Check como gate**: `plan.md` e `tasks.md` de cada feature
  MUST referenciar e respeitar os Principios I-VI; `analyze` valida
  alinhamento entre spec/plan/tasks e esta constituicao.
- **Excecoes**: uma violacao consciente de SHOULD e registrada com
  rationale; uma violacao de MUST/NON-NEGOTIABLE invalida o artefato ate
  ser corrigida ou a constituicao ser emendada via SemVer.

**Version**: 1.0.0 | **Ratified**: 2026-05-24 | **Last Amended**: 2026-05-24
