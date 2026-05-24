/**
 * Overview — tela Visao Geral (US1) — placeholder para FASE 6.
 * Estrutura completa implementada na FASE 6.
 * Ref: spec.md §User Story 1; tasks.md §6.1
 */
import { useOverview } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import type { PeriodParam } from '@cstk-panel/shared-types';

interface OverviewProps {
  period: PeriodParam;
}

export function Overview({ period }: OverviewProps) {
  const query = useOverview(period);
  const { isLoading, isEmpty, isError, errorMessage } = useApiState(query);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar dados.'} />;
  if (isEmpty) return <EmptyState title="Nenhuma execucao registrada" subtitle="Execute o orquestrador para ver dados aqui." />;

  const data = query.data?.data as Record<string, unknown> | null;

  return (
    <div>
      <div style={{ color: 'var(--text-2)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
        Visao Geral — FASE 6 em implementacao
      </div>
      <div className="card">
        <div className="card-body">
          <pre style={{ fontSize: 11, color: 'var(--text-1)', overflow: 'auto', maxHeight: 400 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
