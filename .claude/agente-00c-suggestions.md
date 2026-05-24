# Sugestoes do Agente-00C — exec-2026-05-24T19-13-59Z-agente-00c-cstk-panel

Total: 1 sugestoes registradas.

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

