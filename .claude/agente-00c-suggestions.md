# Sugestoes do Agente-00C — exec-2026-05-24T19-13-59Z-agente-00c-cstk-panel

Total: 2 sugestoes registradas.

## sug-001 — skill `agente-00c-orchestrator` — severidade: aviso

**Criada em**: 2026-05-24T20:28:39Z

**Issue aberta**: (nenhuma)

**Diagnostico**:

Ondas conduzidas pelo subagente agente-00c-orchestrator no modelo sonnet (onda-001 briefing, onda-004 checklist) executaram a skill da etapa corretamente porem NAO completaram o bookkeeping de orquestracao: deixaram a onda aberta (.ondas[-1].fim/etapas_executadas/motivo_termino vazios), nao avancaram .etapa_corrente/.proxima_instrucao e NAO emitiram a linha 'Schedule intent' exigida pelo contrato. Ondas em opus (002 constitution+specify+clarify, 003 plan) fecharam corretamente. Correlacao forte com o modelo sonnet, que parece tratar o prompt como execucao-de-skill e ignorar o protocolo de encerramento de onda.

**Proposta**:

Tornar o protocolo de encerramento de onda mais robusto a modelos menos capazes: (a) mover o fechamento de onda + emissao de Schedule intent para um checklist FINAL imperativo e curto no topo do prompt do orchestrator, repetido ao fim; ou (b) o /agente-00c-resume detectar onda aberta apos retorno do subagente e reconciliar automaticamente (ja feito manualmente pelo comando-pai aqui via dec-005/dec-027); ou (c) phase-model-map evitar sonnet para ondas que exigem bookkeeping de encerramento, preferindo opus/sonnet-com-guardrail.

**Referencias**:

- (sem referencias)

---

## sug-002 — skill `agente-00c-orchestrator` — severidade: impeditiva

**Criada em**: 2026-05-24T22:39:20Z

**Issue aberta**: (nenhuma)

**Diagnostico**:

Wave conduzido em modelo HAIKU (onda-013 review-task) nao executou o Loop passo 2 (start nova onda) nem o protocolo de encerramento: sobrescreveu o registro .ondas[-1] da onda ANTERIOR (onda-012 execute-task) com dados da etapa corrente, causando PERDA de registro no audit trail (variante mais grave que o gap sonnet das ondas 001/004/005, que apenas deixavam a onda incompleta). ondas_total nao foi incrementado. Modelos menos capazes (haiku << sonnet << opus) degradam progressivamente o cumprimento do protocolo de bookkeeping de onda.

**Proposta**:

O encerramento de onda deve ser à prova de modelos fracos: (1) /agente-00c-resume deve, no passo 6, ANEXAR um registro de onda novo ANTES de spawnar o orquestrador (em vez de confiar que o subagente faca via Loop passo 2), e validar no retorno que .ondas cresceu em 1 e ondas_total foi incrementado — reconciliando automaticamente se nao; (2) alternativamente, phase-model-map NAO deve rotear review-task/briefing/checklist para haiku enquanto o protocolo de bookkeeping depender do subagente; (3) mover a criacao/fechamento de onda inteiramente para o comando-pai (resume/agente-00c), deixando o subagente apenas executar a skill da etapa.

**Referencias**:

- (sem referencias)

---

