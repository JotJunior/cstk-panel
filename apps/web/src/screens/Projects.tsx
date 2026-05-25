/**
 * Projects — lista de projetos com rollup (cards) + tabela de todas as features.
 * Layout do prototipo (screens_main.jsx · ProjectsScreen).
 * Ref: spec.md FR-022 (drill-down)
 */
import { useNavigate } from 'react-router-dom';
import { useProjects, useFeatures } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import { FeaturesTable } from '@/components/FeaturesTable.js';
import { MiniStat } from '@/components/index.js';
import { fmtNum, fmtDur, fmtRelative } from '@/lib/format.js';
import type { ProjectRollup, FeatureRollup } from '@cstk-panel/shared-types';

const ACTIVE = new Set(['em_andamento', 'aguardando_humano']);

export function Projects() {
  const navigate = useNavigate();
  const projectsQ = useProjects();
  const featuresQ = useFeatures();
  const { isLoading, isError, errorMessage, isEmpty } = useApiState(projectsQ);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar projetos.'} />;
  if (isEmpty) return <EmptyState title="Nenhum projeto" subtitle="Execute o orquestrador para ver dados aqui." />;

  const projects = (projectsQ.data?.data ?? []) as ProjectRollup[];
  const features = (featuresQ.data?.data ?? []) as FeatureRollup[];

  const byProject = new Map<string, FeatureRollup[]>();
  for (const f of features) {
    const arr = byProject.get(f.project) ?? [];
    arr.push(f);
    byProject.set(f.project, arr);
  }

  return (
    <div className="col gap-4">
      <div className="page-head">
        <div>
          <h1>Projetos</h1>
          <div className="sub">{projects.length} projetos · rollup de execuções, custo e qualidade</div>
        </div>
      </div>

      <div className="grid-3">
        {projects.map(p => {
          const fs = byProject.get(p.project) ?? [];
          const concluidas = fs.filter(f => f.latestStatus === 'concluida').length;
          const emAndamento = fs.filter(f => f.latestStatus && ACTIVE.has(f.latestStatus)).length;
          const abortadas = fs.filter(f => f.latestStatus === 'abortada').length;
          const alertas = p.openAlerts ?? 0;
          return (
            <div
              key={p.project}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/projects/${encodeURIComponent(p.project)}`)}
            >
              <div className="card-pad">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-0)' }}>{p.project}</div>
                  {alertas > 0 && (
                    <span className="tag" style={{ background: 'var(--critical-soft)', color: 'var(--critical)', borderColor: 'transparent' }}>
                      {alertas} alerta{alertas !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="divider" />

                <div className="grid-4" style={{ gap: 8 }}>
                  <MiniStat label="features" value={fs.length} />
                  <MiniStat label="concluídas" value={concluidas} valueColor="var(--success)" />
                  <MiniStat label="em andamento" value={emAndamento} valueColor="var(--inprogress)" />
                  <MiniStat label="abortadas" value={abortadas} valueColor="var(--text-2)" />
                </div>

                <div className="divider" />

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <MiniStat label="tool_calls" value={fmtNum(p.totalToolCalls)} />
                  <MiniStat label="wallclock" value={fmtDur(p.totalWallclock)} />
                  <MiniStat label="decisões" value={fmtNum(p.totalDecisions)} />
                </div>

                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                  <span className="muted" style={{ fontSize: 11 }}>última atividade {fmtRelative(p.latestExecutionAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Todas as features</h3>
          <span className="mono muted" style={{ fontSize: 11 }}>{features.length} features</span>
        </div>
        <FeaturesTable features={features} />
      </div>
    </div>
  );
}
