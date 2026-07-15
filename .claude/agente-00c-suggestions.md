# Sugestoes do Agente-00C — feat-state-watchers-and-docs-20260715T061306Z

Total: 1 sugestoes registradas.

## sug-001 — skill `agente-00c-runtime` — severidade: aviso

**Criada em**: 2026-07-15T10:36:01Z

**Issue aberta**: (nenhuma)

**Diagnostico**:

budget.sh check monitora 3 dimensoes (tool_calls, wallclock, state_size), mas .budgets.tool_calls_current_wave permanece 0 nas 5 ondas desta execucao (onda-001..onda-005), porque nenhuma instrucao do orquestrador (feature-00c-orchestrator.md) chama state-ondas.sh tool-call-tick apos invocacoes de Bash/Skill/Agent — o subcomando existe e funciona (incrementa via jq), mas nunca e invocado no Loop principal documentado

**Proposta**:

Adicionar ao Loop principal do orquestrador (specify..review-task) uma chamada explicita a 'state-ondas.sh tool-call-tick --state-dir $SD' apos cada tool call relevante (ou, alternativa mais robusta: mover a contagem para fora do orquestrador — um hook do harness Claude Code que incremente automaticamente, ja que depender do LLM lembrar de chamar tick apos cada tool call e fragil). Sem isso, o threshold tool_calls_threshold_wave (default 80) e permanentemente inalcancavel e 1/3 dos gatilhos de fechamento de onda de budget.sh fica morto

**Referencias**:

- skills/agente-00c-runtime/scripts/budget.sh
- skills/agente-00c-runtime/scripts/state-ondas.sh
- agents/agente-00c-feature-orchestrator.md

---

