/**
 * Features — tabela de todas as features cross-project.
 * Layout do prototipo (screens_main.jsx · FeaturesListScreen).
 */
import { useFeatures } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import { FeaturesTable } from '@/components/FeaturesTable.js';
import type { FeatureRollup } from '@cstk-panel/shared-types';

export function Features() {
  const query = useFeatures();
  const { isLoading, isError, errorMessage, isEmpty } = useApiState(query);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar features.'} />;
  if (isEmpty) return <EmptyState title="Nenhuma feature" subtitle="Execute o orquestrador para ver dados aqui." />;

  const features = (query.data?.data ?? []) as FeatureRollup[];

  return (
    <div className="col gap-4">
      <div className="page-head">
        <div>
          <h1>Features</h1>
          <div className="sub">{features.length} features · todas, cross-project</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Features · todas</h3>
          <span className="mono muted" style={{ fontSize: 11 }}>{features.length} features</span>
        </div>
        <FeaturesTable features={features} />
      </div>
    </div>
  );
}
