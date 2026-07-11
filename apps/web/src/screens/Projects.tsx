/**
 * Projects — lista de projetos com rollup: tabela no desktop, cards no mobile.
 * Layout do prototipo (screens_main.jsx · ProjectsScreen).
 * Ref: spec.md FR-022 (drill-down)
 */
import { useNavigate } from 'react-router-dom';
import { useProjects, useFeatures } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import { MiniStat } from '@/components/index.js';
import { fmtNum, fmtDur, fmtRelative } from '@/lib/format.js';
import type { ProjectRollup, FeatureRollup } from '@cstk-panel/shared-types';

const ACTIVE = new Set(['em_andamento', 'aguardando_humano']);

interface ProjectRow {
  rollup: ProjectRollup;
  featureCount: number;
  done: number;
  inProgress: number;
  aborted: number;
  alerts: number;
}

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

  const rows: ProjectRow[] = projects.map(p => {
    const fs = byProject.get(p.project) ?? [];
    return {
      rollup: p,
      featureCount: fs.length,
      done: fs.filter(f => f.latestStatus === 'concluida').length,
      inProgress: fs.filter(f => f.latestStatus && ACTIVE.has(f.latestStatus)).length,
      aborted: fs.filter(f => f.latestStatus === 'abortada').length,
      alerts: p.openAlerts ?? 0,
    };
  });

  const openProject = (project: string) => navigate(`/projects/${encodeURIComponent(project)}`);

  return (
    <div className="col gap-4">
      <div className="page-head">
        <div>
          <h1>Projetos</h1>
          <div className="sub">{projects.length} projetos · rollup de execuções, custo e qualidade</div>
        </div>
      </div>

      <div className="card projects-list">
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Projeto</th>
                <th className="num">Features</th>
                <th className="num">Concluídas</th>
                <th className="num">Em andamento</th>
                <th className="num">Abortadas</th>
                <th className="num">Tool calls</th>
                <th className="num">Wallclock</th>
                <th className="num">Decisões</th>
                <th className="num">Alertas</th>
                <th>Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.rollup.project} className="clickable" onClick={() => openProject(r.rollup.project)}>
                  <td><div style={{ fontWeight: 500, color: 'var(--text-0)' }}>{r.rollup.project}</div></td>
                  <td className="num">{r.featureCount}</td>
                  <td className="num" style={r.done > 0 ? { color: 'var(--success)' } : undefined}>{r.done}</td>
                  <td className="num" style={r.inProgress > 0 ? { color: 'var(--inprogress)' } : undefined}>{r.inProgress}</td>
                  <td className="num">{r.aborted}</td>
                  <td className="num">{fmtNum(r.rollup.totalToolCalls)}</td>
                  <td className="num">{fmtDur(r.rollup.totalWallclock)}</td>
                  <td className="num">{fmtNum(r.rollup.totalDecisions)}</td>
                  <td className="num">
                    {r.alerts > 0
                      ? <span style={{ color: 'var(--critical)', fontWeight: 600 }}>{r.alerts}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtRelative(r.rollup.latestExecutionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-3 projects-cards">
        {rows.map(r => (
          <div
            key={r.rollup.project}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => openProject(r.rollup.project)}
          >
            <div className="card-pad">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-0)' }}>{r.rollup.project}</div>
                {r.alerts > 0 && (
                  <span className="tag" style={{ background: 'var(--critical-soft)', color: 'var(--critical)', borderColor: 'transparent' }}>
                    {r.alerts} alerta{r.alerts !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="divider" />

              <div className="grid-4" style={{ gap: 8 }}>
                <MiniStat label="features" value={r.featureCount} />
                <MiniStat label="concluídas" value={r.done} valueColor="var(--success)" />
                <MiniStat label="em andamento" value={r.inProgress} valueColor="var(--inprogress)" />
                <MiniStat label="abortadas" value={r.aborted} valueColor="var(--text-2)" />
              </div>

              <div className="divider" />

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <MiniStat label="tool_calls" value={fmtNum(r.rollup.totalToolCalls)} />
                <MiniStat label="wallclock" value={fmtDur(r.rollup.totalWallclock)} />
                <MiniStat label="decisões" value={fmtNum(r.rollup.totalDecisions)} />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <span className="muted" style={{ fontSize: 11 }}>última atividade {fmtRelative(r.rollup.latestExecutionAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
