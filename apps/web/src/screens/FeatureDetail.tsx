/**
 * FeatureDetail — cabecalho + stats + tabela de execucoes da feature.
 * Layout do prototipo (screens_main.jsx · FeatureDetailScreen).
 */
import { useNavigate, useParams } from 'react-router-dom';
import { useFeature } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import { StatusBadge, MiniStat, PipelineProgress, Icon } from '@/components/index.js';
import { fmtNum, fmtDur, fmtTimestamp } from '@/lib/format.js';
import { stackDisplayItems } from '@/lib/stack-display.js';
import type { ExecutionDTO, RetroDTO } from '@cstk-panel/shared-types';

interface FeatureRollupShape {
  totalExecutions: number;
  totalToolCalls: number | null;
  totalWallclock: number | null;
  totalDecisions: number | null;
  totalWaves: number | null;
  currentStage: string | null;
  latestStatus: 'em_andamento' | 'aguardando_humano' | 'concluida' | 'abortada' | null;
}

export function FeatureDetail() {
  const navigate = useNavigate();
  const { project = '', feature = '' } = useParams();
  const query = useFeature(project, feature);
  const { isLoading, isError, errorMessage } = useApiState(query);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar feature.'} />;

  const data = query.data?.data as { rollup?: FeatureRollupShape; executions?: ExecutionDTO[]; retros?: RetroDTO[] } | null;
  if (!data) return <EmptyState title="Feature não encontrada" subtitle={`${project} / ${feature}`} />;

  const rollup = data.rollup;
  const executions = data.executions ?? [];
  const retros = data.retros ?? [];
  const status = rollup?.latestStatus ?? null;

  // Stack: primeira execucao com stack_sugerida (CARD-FTD-02)
  const stack = executions.find(e => e.suggestedStack)?.suggestedStack ?? null;
  const stackItems = stackDisplayItems(stack);
  // Execucao mais recente para "Ver execução" (CARD-FTD-03)
  const latestExecId = executions[0]?.executionId ?? null;

  return (
    <div className="col gap-4">
      {/* Cabecalho */}
      <div className="card">
        <div className="card-pad">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div className="row gap-2">
                <StatusBadge status={status} />
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{feature}</h2>
              </div>
              <div className="prov" style={{ marginTop: 6 }}>
                <a onClick={() => navigate(`/projects/${encodeURIComponent(project)}`)}>{project}</a>
                <span className="sep">/</span>
                <span>{feature}</span>
              </div>
              {stackItems.length > 0 && (
                <div className="row gap-2" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {stackItems.map(s => (
                    <span key={s} style={{
                      padding: '2px 7px', borderRadius: 8, fontSize: 11,
                      background: 'var(--bg-3)', color: 'var(--text-1)',
                      border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
                    }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="row gap-2" style={{ flexShrink: 0, alignItems: 'flex-start' }}>
              <button
                className="tb-btn"
                disabled={!latestExecId}
                onClick={() => latestExecId && navigate(`/executions/${encodeURIComponent(latestExecId)}`)}
              >
                <Icon name="activity" size={13} aria-hidden />Ver execução
              </button>
              <button className="tb-btn" disabled title="Disponível via skill decision-tree (externo)">
                <Icon name="tree" size={13} aria-hidden />Árvore de decisões
              </button>
            </div>
          </div>

          <div className="divider" />

          <div className="grid-6">
            <MiniStat label="Etapa corrente" value={<span className="mono" style={{ color: status === 'em_andamento' ? 'var(--inprogress)' : 'var(--text-0)' }}>{rollup?.currentStage ?? '—'}</span>} />
            <MiniStat label="Ondas" value={fmtNum(rollup?.totalWaves)} />
            <MiniStat label="Tool calls" value={fmtNum(rollup?.totalToolCalls)} />
            <MiniStat label="Wallclock" value={fmtDur(rollup?.totalWallclock)} />
            <MiniStat label="Decisões" value={fmtNum(rollup?.totalDecisions)} />
            <MiniStat label="Execuções" value={rollup?.totalExecutions ?? executions.length} />
          </div>

          <div style={{ marginTop: 14 }}>
            <PipelineProgress etapa={rollup?.currentStage ?? null} status={status} labeled />
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
                <tr key={e.executionId || idx} className="clickable" onClick={() => navigate(`/executions/${encodeURIComponent(e.executionId)}`)}>
                  <td className="mono" style={{ color: 'var(--accent)', fontSize: 11.5 }}>{e.executionId.slice(0, 40)}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{fmtTimestamp(e.startedAt)}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{fmtTimestamp(e.finishedAt)}</td>
                  <td className="num">{fmtDur(e.durationSeconds)}</td>
                  <td className="num">{e.wavesTotal ?? '—'}</td>
                  <td className="num">{fmtNum(e.toolCallsTotal)}</td>
                  <td className="mono muted" style={{ fontSize: 11.5 }}>{e.terminationReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retrospectivas (CARD-FTD-06) */}
      <div className="card">
        <div className="card-head">
          <h3>Retrospectivas</h3>
          <span className="mono muted" style={{ fontSize: 11 }}>{retros.length} entrada{retros.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-pad col" style={{ gap: 8 }}>
          {retros.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
              Sem retros ainda. Retros são geradas ao final das ondas relevantes.
            </div>
          ) : (
            retros.map((r, idx) => (
              <div key={`${r.executionId}/${r.wave}/${idx}`} style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                <div className="row gap-2" style={{ marginBottom: 6 }}>
                  <span className="tag accent">retro</span>
                  <span className="mono muted" style={{ fontSize: 11.5 }}>{r.wave}</span>
                </div>
                <div style={{ color: 'var(--text-1)', fontSize: 12.5 }}>{r.text ?? '—'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
