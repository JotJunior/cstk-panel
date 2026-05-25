/**
 * FeatureDetail — cabecalho + stats + tabela de execucoes da feature.
 * Layout do prototipo (screens_main.jsx · FeatureDetailScreen).
 */
import { useNavigate, useParams } from 'react-router-dom';
import { useFeature } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import { StatusBadge, MiniStat, PipelineProgress } from '@/components/index.js';
import { fmtNum, fmtDur, fmtTimestamp } from '@/lib/format.js';
import type { ExecutionDTO } from '@cstk-panel/shared-types';

interface FeatureRollupShape {
  totalExecutions: number;
  totalToolCalls: number | null;
  totalWallclock: number | null;
  totalDecisions: number | null;
  totalOndas: number | null;
  etapaCorrente: string | null;
  latestStatus: 'em_andamento' | 'aguardando_humano' | 'concluida' | 'abortada' | null;
}

export function FeatureDetail() {
  const navigate = useNavigate();
  const { project = '', feature = '' } = useParams();
  const query = useFeature(project, feature);
  const { isLoading, isError, errorMessage } = useApiState(query);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar feature.'} />;

  const data = query.data?.data as { rollup?: FeatureRollupShape; executions?: ExecutionDTO[] } | null;
  if (!data) return <EmptyState title="Feature não encontrada" subtitle={`${project} / ${feature}`} />;

  const rollup = data.rollup;
  const executions = data.executions ?? [];
  const status = rollup?.latestStatus ?? null;

  return (
    <div className="col gap-4">
      {/* Cabecalho */}
      <div className="card">
        <div className="card-pad">
          <div className="row gap-2">
            <StatusBadge status={status} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{feature}</h2>
          </div>
          <div className="prov" style={{ marginTop: 6 }}>
            <a onClick={() => navigate(`/projects/${encodeURIComponent(project)}`)}>{project}</a>
            <span className="sep">/</span>
            <span>{feature}</span>
          </div>

          <div className="divider" />

          <div className="grid-6">
            <MiniStat label="Etapa corrente" value={<span className="mono" style={{ color: status === 'em_andamento' ? 'var(--inprogress)' : 'var(--text-0)' }}>{rollup?.etapaCorrente ?? '—'}</span>} />
            <MiniStat label="Ondas" value={fmtNum(rollup?.totalOndas)} />
            <MiniStat label="Tool calls" value={fmtNum(rollup?.totalToolCalls)} />
            <MiniStat label="Wallclock" value={fmtDur(rollup?.totalWallclock)} />
            <MiniStat label="Decisões" value={fmtNum(rollup?.totalDecisions)} />
            <MiniStat label="Execuções" value={rollup?.totalExecutions ?? executions.length} />
          </div>

          <div style={{ marginTop: 14 }}>
            <PipelineProgress etapa={rollup?.etapaCorrente ?? null} status={status} labeled />
          </div>
        </div>
      </div>

      {/* Execucoes */}
      <div className="card">
        <div className="card-head">
          <h3>Execuções</h3>
          <span className="mono muted" style={{ fontSize: 11 }}>{executions.length} registro{executions.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>execucao_id</th>
                <th>Status</th>
                <th>Iniciada</th>
                <th>Terminada</th>
                <th className="num">Duração</th>
                <th className="num">Ondas</th>
                <th className="num">Tool calls</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>Sem execuções.</td></tr>
              ) : executions.map((e, idx) => (
                <tr key={e.execucaoId || idx} className="clickable" onClick={() => navigate(`/executions/${encodeURIComponent(e.execucaoId)}`)}>
                  <td className="mono" style={{ color: 'var(--accent)', fontSize: 11.5 }}>{e.execucaoId.slice(0, 40)}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{fmtTimestamp(e.iniciadaEm)}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{fmtTimestamp(e.terminadaEm)}</td>
                  <td className="num">{fmtDur(e.duracaoSegundos)}</td>
                  <td className="num">{e.ondasTotal ?? '—'}</td>
                  <td className="num">{fmtNum(e.toolCallsTotal)}</td>
                  <td className="mono muted" style={{ fontSize: 11.5 }}>{e.motivoTermino ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
