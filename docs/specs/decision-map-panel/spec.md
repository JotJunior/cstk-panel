# Feature Specification: Decision Map Panel

**Feature**: `decision-map-panel`
**Created**: 2026-05-29
**Status**: Draft

> **Nota de escopo vs. Princípio IV da constitution**: a skill `decision-tree`
> opera sobre `state.json` (fonte transacional) e produz análise offline.
> Esta feature opera sobre dados **já ingeridos** na `knowledge.db`
> (índice derivado, tabela `decisions`) e entrega **observabilidade ao vivo**
> no painel. São fontes, propósitos e públicos distintos — não há
> reimplementação do dono canônico.

> **Decisões de infraestrutura**: N/A — feature stateless, sem scheduling,
> sem persistência própria, sem tokens externos. Read-only sobre API existente.

---

## User Scenarios & Testing

### User Story 1 — Abrir o mapa de decisões de uma execução (Priority: P1)

O engenheiro que acompanha uma execução autônoma quer ver, numa visão
dedicada, a sequência completa de decisões tomadas pelo agente — quais opções
foram consideradas, qual foi escolhida e como cada decisão se encadeia com a
próxima. Ele clica no botão "Árvore de decisões" na tela de detalhe da
execução e o mapa é exibido sem sair da tela.

**Why this priority**: é a razão de existir do botão; sem isso, o botão
continua desabilitado e a feature não entrega nenhum valor.

**Independent Test**: com uma execução que possui pelo menos 3 decisões,
clicar no botão "Árvore de decisões" deve mostrar um mapa com nós visuais
representando cada decisão, sem recarregar a página.

**Acceptance Scenarios**:

1. **Given** o usuário está na tela de detalhe de uma execução com decisões
   registradas, **When** clica em "Árvore de decisões", **Then** o mapa é
   aberto inline (ou como painel/overlay), exibindo cada decisão como um nó
   identificável, e o botão muda de estado para indicar modo ativo.

2. **Given** o mapa está aberto, **When** a execução não possui decisões
   (contagem = 0), **Then** o mapa exibe estado vazio com mensagem explicativa
   ("Nenhuma decisão registrada para esta execução.").

3. **Given** o mapa está aberto e a API retorna erro, **Then** o mapa exibe
   estado de erro com possibilidade de retry, sem travar a tela principal.

4. **Given** o mapa está aberto, **When** o usuário clica novamente em
   "Árvore de decisões" (ou num botão de fechar), **Then** o mapa é fechado e
   a tela retorna ao estado anterior.

---

### User Story 2 — Inspecionar uma decisão individual (Priority: P1)

Ao ver o mapa, o engenheiro quer entender em detalhe uma decisão específica —
contexto, justificativa, evidência empírica e opções descartadas. Ele clica
num nó e um painel lateral direito exibe todos os campos da decisão sem fechar
o mapa.

**Why this priority**: sem o painel de detalhe, o mapa é só um esqueleto
visual sem utilidade de diagnóstico; ambas as histórias P1 formam o MVP
mínimo.

**Independent Test**: clicar em qualquer nó do mapa deve abrir o painel
lateral com os campos da decisão correspondente; clicar em outro nó deve
substituir o conteúdo do painel sem fechar o mapa.

**Acceptance Scenarios**:

1. **Given** o mapa está aberto com nós visíveis, **When** o usuário clica
   num nó de decisão, **Then** o painel lateral direito se abre (ou é
   atualizado) exibindo: escolha, opções consideradas com a escolhida
   destacada, contexto, justificativa, evidência (se presente), etapa, onda e
   score.

2. **Given** o painel lateral está aberto com a decisão A, **When** o usuário
   clica no nó da decisão B, **Then** o painel exibe os dados de B sem
   fechar o mapa.

3. **Given** o painel lateral está aberto, **When** o usuário clica fora do
   painel ou em botão de fechar, **Then** o painel fecha e o mapa continua
   visível.

4. **Given** um campo textual no painel (contexto, justificativa, evidência),
   **Then** ele é renderizado como texto puro — nunca como HTML ativo — mesmo
   que o conteúdo contenha tags, scripts ou diretivas.

---

### User Story 3 — Identificar opções e a escolha em cada nó (Priority: P2)

O engenheiro quer entender, diretamente no nó visual do mapa, quais opções
o agente considerou e qual foi selecionada — sem precisar abrir o painel
lateral para cada decisão. Os nós devem ser suficientemente informativos para
uma leitura de varredura.

**Why this priority**: melhora a legibilidade do mapa como um todo, mas o
MVP já funciona sem isso (detalhe está no painel lateral).

**Independent Test**: num mapa com decisões que possuem opções registradas,
cada nó deve exibir minimamente a escolha feita e um indicador de quantas
opções foram consideradas.

**Acceptance Scenarios**:

1. **Given** uma decisão com opções registradas, **Then** o nó exibe a
   `escolha` como rótulo principal e as opções não-escolhidas de forma
   secundária (ex: chips, lista compacta ou tooltip) com a escolhida
   visualmente destacada.

2. **Given** uma decisão sem opções registradas (campo `opcoes` nulo),
   **Then** o nó exibe apenas a `escolha` sem área de opções — sem erro,
   sem placeholder vazio.

3. **Given** uma decisão com score registrado, **Then** o nó exibe o score
   com codificação de cor consistente com o restante do painel (0 = crítico,
   1 = atenção, 2 = ok, 3 = verde/evidência).

---

### User Story 4 — Navegar pela cadeia de decisões (Priority: P2)

O engenheiro quer seguir a sequência de decisões ao longo da execução —
entendendo qual decisão veio antes e qual veio depois. As decisões estão
encadeadas por ordem de ocorrência dentro de cada onda e entre ondas.

**Why this priority**: o encadeamento é o que torna o mapa uma "árvore" e
não apenas uma lista visual; sem isso é só outra forma de exibir a tabela de
decisões.

**Independent Test**: num mapa com decisões de múltiplas ondas, deve ser
possível seguir visualmente a progressão de uma decisão à próxima pela
conexão entre nós.

**Acceptance Scenarios**:

1. **Given** o mapa está aberto com decisões de múltiplas ondas, **Then**
   nós de decisões da mesma onda são agrupados ou proximamente dispostos, e
   a progressão entre ondas é visualmente distinguível.

2. **Given** o mapa está aberto, **Then** as arestas (conexões) entre nós
   indicam a direção da sequência (anterior → próxima).

3. **Given** o usuário está com o painel de detalhe aberto para a decisão N,
   **Then** o painel indica (via rótulo ou link) a decisão anterior e a
   próxima na sequência, permitindo navegação sem voltar ao mapa.

---

### Edge Cases

- O que acontece quando a execução tem centenas de decisões? O mapa deve
  carregar progressivamente ou paginado, sem travar o navegador.
- Como o mapa se comporta quando filtrado por onda (o `waveFilter` já
  disponível na tela)? O mapa deve refletir o filtro ativo.
- O que acontece quando a decisão não tem `contexto`, `justificativa` e
  `evidência` — tudo nulo? O painel lateral exibe apenas os campos presentes,
  sem áreas vazias "flutuando".
- Como o mapa responde a uma lista de decisões com uma única decisão? Deve
  exibir um nó único sem arestas, sem erro de layout.
- O que acontece quando o usuário navega para outra tela com o mapa aberto?
  O estado do mapa não deve ser mantido ao retornar (sem memory leak de
  estado de UI).

---

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE habilitar o botão "Árvore de decisões" na tela
  de detalhe de execução, tornando-o funcional (removendo o atributo
  `disabled` e o título que aponta para recurso externo).

- **FR-002**: O sistema DEVE exibir um mapa visual de decisões composto por
  nós e conexões direcionadas, derivado exclusivamente dos dados já disponíveis
  via o endpoint de decisões da execução — sem nenhuma nova fonte de dados ou
  endpoint adicional.

- **FR-003**: Cada nó do mapa DEVE representar uma decisão individual e
  exibir, no mínimo: a escolha feita, o score (com cor semântica) e a onda
  de origem.

- **FR-004**: O sistema DEVE marcar visualmente a opção escolhida em cada
  nó, distinguindo-a das opções descartadas, usando a lógica já existente de
  correspondência entre `escolha` e `opcoes`.

- **FR-005**: O sistema DEVE conectar nós de decisões pela sequência de
  ocorrência — ordenados por onda e pela posição dentro da onda — com
  arestas direcionadas indicando progressão.

- **FR-006**: Ao clicar num nó do mapa, o sistema DEVE abrir um painel
  lateral no lado direito da tela exibindo todos os campos disponíveis da
  decisão selecionada: escolha, opções, contexto, justificativa, evidência,
  etapa, onda, agente e score.

- **FR-007**: O painel lateral DEVE renderizar todos os campos textuais
  originados de agentes (`contexto`, `justificativa`, `evidência`, `escolha`,
  `agente`) como texto puro, sem interpretação de HTML ou markup ativo.

- **FR-008**: O mapa DEVE implementar os quatro estados obrigatórios do
  painel: carregando (skeleton), vazio (sem decisões), erro (falha de API),
  degradado (dados parciais com `meta.degraded=true`).

- **FR-009**: O mapa DEVE respeitar o filtro de onda ativo na tela de
  detalhe da execução — quando um filtro de onda estiver selecionado, o mapa
  exibe apenas decisões daquela onda.

- **FR-010**: O mapa DEVE ser acessível por teclado: navegação entre nós por
  Tab/setas, ativação de nó por Enter/Espaço, fechamento do painel lateral
  por Escape.

- **FR-011**: O sistema NÃO DEVE consultar o `state.json` diretamente, NÃO
  DEVE invocar a skill `decision-tree` e NÃO DEVE criar nenhum endpoint
  novo no back-end — toda a funcionalidade opera sobre dados existentes na
  `knowledge.db` via API já disponível.

- **FR-012**: O mapa DEVE suportar execuções com grande volume de decisões
  sem travar a interface — aplicando limite/paginação consistente com o
  restante do painel (máximo definido pelo `limit` do hook `useDecisions`).

- **FR-013**: O botão "Árvore de decisões" na tela `FeatureDetail` DEVE
  permanecer desabilitado — a visão de mapa é exclusiva do contexto de uma
  execução individual, onde as decisões têm sequência definida.

### Key Entities

- **Decisão** (`DecisionDTO`): unidade atômica do mapa — identificada por
  `wave` + posição na lista; possui `escolha`, `opcoes`, `score`, `contexto`,
  `justificativa`, `evidencia`, `etapa`, `agente`.

- **Nó do mapa**: representação visual de uma decisão; estado: neutro,
  selecionado (clicado), em foco (teclado). Rótulo principal = `escolha`.

- **Aresta**: conexão direcional entre dois nós consecutivos na sequência de
  decisões. Não carrega dados próprios — é derivada da ordenação.

- **Painel lateral de detalhe**: exibe os campos completos de um `DecisionDTO`
  selecionado. Estado: fechado, aberto com decisão N. Conteúdo UNTRUSTED.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: O botão "Árvore de decisões" na tela de detalhe de execução
  está habilitado e abre o mapa em 100% das execuções com ao menos uma
  decisão registrada.

- **SC-002**: O mapa carrega e renderiza até 20 decisões (página padrão) em
  menos de 2 segundos em conexão local, sem travamentos perceptíveis.

- **SC-003**: Ao clicar em qualquer nó, o painel lateral abre e exibe o
  conteúdo correto da decisão em menos de 200ms (dado já carregado em memória
  — sem request adicional).

- **SC-004**: Campos textuais com conteúdo adversarial (tags HTML, scripts,
  diretivas de agente) são renderizados como texto literal em 100% dos casos —
  verificável por teste automatizado com payload sintético.

- **SC-005**: O mapa exibe corretamente o estado vazio, estado de erro e
  estado degradado — verificável por mock de API em testes.

- **SC-006**: Toda a interação com o mapa (abrir, clicar em nó, fechar painel,
  fechar mapa) é realizável exclusivamente via teclado.

- **SC-007**: Nenhum endpoint novo é adicionado ao back-end — verificável por
  diff do código do servidor.
