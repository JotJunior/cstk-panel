/**
 * Overview — tela Visao Geral (US1).
 * Consome useOverview(period) — dados reais da knowledge.db.
 * 4 estados: loading/empty/error/degraded (US6, FR-006).
 *
 * Principio III: nenhum rotulo usa "$"/USD/tokens — apenas "proxy: tool calls".
 * Ref: spec.md §User Story 1; tasks.md §6.1
 */
import { useNavigate } from 'react-router-dom';
import { useOverview } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState, DegradedBanner } from '@/states/index.js';
import { KpiCard, StatusBadge, Icon } from '@/components/index.js';
import { selectOverview, type OverviewRaw } from '@/lib/overview-select.js';
import type { PeriodParam } from '@cstk-panel/shared-types';

interface OverviewProps {
  period: PeriodParam;
}

// ---------------------------------------------------------------------------
// Helpers de formatacao
// ---------------------------------------------------------------------------
function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '?';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `ha ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `ha ${Math.floor(diff / 3600)}h`;
  return `ha ${Math.floor(diff / 86400)}d`;
}

// ---------------------------------------------------------------------------
// Sub-componentes locais
// ---------------------------------------------------------------------------
const SDD_STAGES = [
  'briefing','constitution','specify','clarify','plan',
  'checklist','create-tasks','execute-task','review-task',
];

function PipelineProgress({ etapa, status }: { etapa: string | null; status: string | null }) {
  const idx = etapa ? SDD_STAGES.indexOf(etapa) : -1;
  const color =
    status === 'concluida' ? 'var(--success)' :
    status === 'abortada' ? 'var(--critical)' :
    status === 'aguardando_humano' ? 'var(--warning)' :
    'var(--inprogress)';

  return (
    <div style={{ display: 'flex', gap: 2, height: 3, borderRadius: 2, overflow: 'hidden' }}>
      {SDD_STAGES.map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            background: i <= idx ? color : 'var(--bg-4)',
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{
        width: 110, fontSize: 11, color: 'var(--text-2)',
        fontFamily: 'var(--font-mono)', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
      </div>
      <div style={{ width: 40, fontSize: 11, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>
        {fmtNum(value)}
      </div>
    </div>
  );
}

function FunnelRow({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? Math.min(100, (count / maxCount) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <div style={{
        width: 96, fontSize: 10.5, color: 'var(--text-2)',
        fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0,
      }}>
        {label.length > 13 ? label.slice(0, 12) + '…' : label}
      </div>
      <div style={{ flex: 1, height: 14, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'rgba(34,211,238,0.4)', borderRadius: 3 }} />
      </div>
      <div style={{
        width: 24, fontSize: 11, color: 'var(--text-1)',
        fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0,
      }}>
        {count}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview principal
// ---------------------------------------------------------------------------
export function Overview({ period }: OverviewProps) {
  const navigate = useNavigate();
  const query = useOverview(period);
  const { isLoading, isEmpty, isError, errorMessage, isDegraded } = useApiState(query);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar dados.'} />;
  if (isEmpty) return <EmptyState title="Nenhuma execucao registrada" subtitle="Execute o orquestrador para ver dados aqui." />;

  const raw = query.data?.data as Record<string, unknown> | null;
  const meta = query.data?.meta;

  // View-model normalizado (camelCase do /overview). Logica pura e testada
  // em lib/overview-select.test.ts — trava o contrato de borda snake_case→camelCase.
  const {
    totalProjects, totalFeatures, emAndamento, aguardando, totalToolCalls,
    totalWaves, totalDecisoes, totalExecucoes, concluidas, abortadas,
    totalAlertas, execucoes, alertas, leaderboard, funnel, maxToolCalls, maxFunnel,
  } = selectOverview(raw as OverviewRaw | null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner degradado transversal */}
      {isDegraded && meta && <DegradedBanner meta={meta} />}

      {/* KPI row — 6 cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 12,
      }}>
        <KpiCard label="Projetos" value={totalProjects} trend={`${totalFeatures} features`} />
        <KpiCard
          label="Em andamento"
          value={emAndamento}
          trend={`${aguardando} aguard. humano`}
          accent="accent"
        />
        {totalAlertas > 0 ? (
          <KpiCard label="Alertas abertos" value={totalAlertas} trend="sinais recentes" accent="warning" />
        ) : (
          <KpiCard label="Alertas abertos" value={totalAlertas} trend="nenhum recente" />
        )}
        <KpiCard
          label="Custo · proxy"
          value={fmtNum(totalToolCalls)}
          trend="tool_calls (nao tokens)"
        />
        <KpiCard label="Ondas" value={fmtNum(totalWaves)} trend="ondas executadas" />
        <KpiCard label="Decisoes" value={fmtNum(totalDecisoes)} trend={`${fmtNum(totalExecucoes)} execucoes`} />
      </div>

      {/* Grid principal 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        {/* Coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Execucoes em andamento */}
          <div className="card">
            <div className="card-head">
              <div className="row gap-2">
                <h3>Execucoes em andamento</h3>
                <span style={{
                  background: 'var(--bg-3)', color: 'var(--text-1)', fontSize: 10,
                  fontWeight: 600, fontFamily: 'var(--font-mono)',
                  padding: '1px 7px', borderRadius: 10,
                }}>
                  {execucoes.length}
                </span>
              </div>
              <span
                style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--text-2)' }}
                onClick={() => navigate('/executions')}
              >
                ver todas →
              </span>
            </div>
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {execucoes.length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                  O orquestrador esta ocioso.
                </div>
              ) : (
                (execucoes as Record<string, unknown>[]).map((f, idx) => {
                  const execId   = (f.execucaoId as string | null) ?? '';
                  const status   = f.status as string | null;
                  const etapa    = f.etapaCorrente as string | null;
                  const project  = f.project as string | null;
                  const feature  = f.feature as string | null;
                  const title    = feature ?? execId.slice(0, 24);
                  return (
                    <div
                      key={execId || idx}
                      style={{
                        background: 'var(--bg-2)', borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--border)', padding: '10px 12px', cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/executions/${encodeURIComponent(execId)}`)}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div className="row gap-2" style={{ marginBottom: 2 }}>
                            <StatusBadge status={status as 'em_andamento' | 'aguardando_humano' | 'concluida' | 'abortada' | null} />
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                            {project}{project && feature ? ' / ' : ''}{feature}
                          </div>
                        </div>
                        <div className="row" style={{ gap: 16 }}>
                          {[
                            { label: 'ondas',      v: String(f.ondasTotal ?? '—') },
                          ].map(stat => (
                            <div key={stat.label} style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{stat.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-0)' }}>{stat.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <PipelineProgress etapa={etapa} status={status} />
                      <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                          etapa · <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--inprogress)' }}>{etapa ?? '—'}</span>
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                          iniciada {fmtRelative(f.iniciadaEm as string | null)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Alertas criticos recentes */}
          <div className="card">
            <div className="card-head">
              <div className="row gap-2">
                <h3>Alertas criticos recentes</h3>
                {alertas.length > 0 && (
                  <span style={{
                    background: 'var(--critical-soft)', color: 'var(--critical)', fontSize: 10,
                    fontWeight: 600, fontFamily: 'var(--font-mono)',
                    padding: '1px 7px', borderRadius: 10,
                  }}>
                    {alertas.length}
                  </span>
                )}
              </div>
              <span
                style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--text-2)' }}
                onClick={() => navigate('/alerts')}
              >
                ver todos →
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Proveniencia</th>
                    <th>Consumido / Threshold</th>
                    <th>Severidade</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>
                        Nenhum alerta recente.
                      </td>
                    </tr>
                  ) : (
                    (alertas as Record<string, unknown>[]).slice(0, 5).map((a, idx) => {
                      const tipo     = a.tipo as string | null;
                      const subtipo  = a.subtipo as string | null;
                      const execId   = a.execucaoId as string | null;
                      const wave     = a.wave as string | null;
                      const consumido  = a.valor_consumido as number | null;
                      const threshold  = a.valor_threshold as number | null;
                      const severity = a.severity as string | null;
                      const pct = consumido != null && threshold != null && threshold > 0
                        ? Math.min(999, Math.round((consumido / threshold) * 100))
                        : null;
                      const sevColor = severity === 'critical' ? 'var(--critical)' : 'var(--warning)';
                      return (
                        <tr
                          key={idx}
                          className="clickable"
                          onClick={() => navigate(`/executions/${encodeURIComponent(execId ?? '')}?tab=alerts`)}
                        >
                          <td>
                            <div className="row gap-2">
                              <Icon name={tipo === 'circular' ? 'activity' : 'alert'} size={13} style={{ color: sevColor }} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-0)' }}>
                                {tipo === 'circular' ? 'circular' : `breach·${subtipo ?? '?'}`}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                              {execId?.slice(0, 28) ?? '—'}
                              {wave ? <span> / <span style={{ color: 'var(--inprogress)' }}>{wave}</span></span> : null}
                            </span>
                          </td>
                          <td>
                            {pct != null ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 60, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: sevColor, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-1)' }}>{pct}%</span>
                              </div>
                            ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '2px 7px', borderRadius: 10,
                              fontSize: 11, fontWeight: 600,
                              background: severity === 'critical' ? 'var(--critical-soft)' : 'var(--warning-soft)',
                              color: sevColor,
                            }}>
                              {severity ?? '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Funil do pipeline */}
          <div className="card">
            <div className="card-head">
              <h3>Funil do pipeline · features por etapa corrente</h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>SDD · 9 etapas</span>
            </div>
            <div style={{ padding: '14px 18px' }}>
              {funnel.length === 0
                ? SDD_STAGES.map(s => <FunnelRow key={s} label={s} count={0} maxCount={1} />)
                : (funnel as Record<string, unknown>[]).map(row => (
                    <FunnelRow
                      key={row.etapa as string}
                      label={(row.etapa as string | null) ?? '?'}
                      count={(row.count as number | null) ?? 0}
                      maxCount={maxFunnel}
                    />
                  ))}
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Leaderboard */}
          <div className="card">
            <div className="card-head">
              <h3>Custo por feature · proxy</h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>tool_calls</span>
            </div>
            <div style={{ padding: '14px 18px' }}>
              {leaderboard.length === 0 ? (
                <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
                  Sem dados de leaderboard.
                </div>
              ) : (
                (leaderboard as Record<string, unknown>[]).slice(0, 8).map((row, idx) => (
                  <MiniBar
                    key={idx}
                    label={(row.feature as string | null) ?? (row.execucaoId as string | null) ?? `#${idx + 1}`}
                    value={(row.toolCallsTotal as number | null) ?? 0}
                    max={maxToolCalls}
                  />
                ))
              )}
            </div>
          </div>

          {/* Status das features */}
          <div className="card">
            <div className="card-head">
              <h3>Status das features</h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{totalFeatures} total</span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'em_andamento',     label: 'Em andamento',    color: 'var(--inprogress)', count: emAndamento },
                { key: 'aguardando_humano', label: 'Aguard. humano', color: 'var(--warning)',    count: aguardando },
                { key: 'concluida',        label: 'Concluidas',      color: 'var(--success)',    count: concluidas },
                { key: 'abortada',         label: 'Abortadas',       color: 'var(--critical)',   count: abortadas },
              ].map(item => (
                <div key={item.key} className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{item.label}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sumario de metricas */}
          <div className="card">
            <div className="card-head">
              <h3>Sumario de metricas</h3>
              <span
                style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--text-2)' }}
                onClick={() => navigate('/metrics')}
              >
                metricas →
              </span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Total decisoes',  value: fmtNum(totalDecisoes) },
                { label: 'Total ondas',     value: fmtNum(totalWaves) },
                { label: 'Execucoes total', value: fmtNum(totalExecucoes) },
                { label: 'Tool calls · proxy', value: fmtNum(totalToolCalls) },
              ].map(stat => (
                <div key={stat.label} className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{stat.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-0)', fontWeight: 600 }}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
