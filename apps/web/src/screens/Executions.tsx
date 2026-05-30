/**
 * Executions — lista de todas as execucoes paginada.
 * Drill-down para ExecutionDetail via clique na linha.
 * Ref: spec.md; tasks.md §execucoes
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExecutions } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState, DegradedBanner } from '@/states/index.js';
import { StatusBadge, PipelineProgress } from '@/components/index.js';
import type { ExecutionDTO } from '@cstk-panel/shared-types';

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
function fmtDur(s: number | null | undefined): string {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function Executions() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const limit = 25;
  const query = useExecutions(limit, page * limit);
  const { isLoading, isError, errorMessage, isDegraded } = useApiState(query);
  const items: ExecutionDTO[] = query.data?.data?.executions ?? [];
  const meta = query.data?.meta;

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar execucoes.'} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isDegraded && meta && <DegradedBanner meta={meta} />}
      <div className="card">
        <div className="card-head">
          <div className="row gap-2">
            <h3>Execucoes · todas</h3>
            <span style={{ background: 'var(--bg-3)', color: 'var(--text-1)', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', padding: '1px 7px', borderRadius: 10 }}>
              {items.length}
            </span>
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState title="Nenhuma execucao registrada" subtitle="Execute o orquestrador para ver dados aqui." />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Execucao</th>
                    <th>Projeto / Feature</th>
                    <th>Status</th>
                    <th style={{ minWidth: 130 }}>Pipeline</th>
                    <th className="num">Ondas</th>
                    <th className="num">Custo · proxy</th>
                    <th className="num">Wallclock</th>
                    <th className="num">Decisoes</th>
                    <th>Iniciada</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e, idx) => (
                    <tr
                      key={e.executionId || idx}
                      className="clickable"
                      onClick={() => navigate(`/executions/${encodeURIComponent(e.executionId)}`)}
                    >
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                          {e.executionId.slice(0, 32)}{e.executionId.length > 32 ? '…' : ''}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-0)', fontSize: 12.5 }}>{e.feature ?? '—'}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-2)' }}>{e.project}</div>
                      </td>
                      <td><StatusBadge status={e.status} /></td>
                      <td><PipelineProgress etapa={e.currentStage} status={e.status} /></td>
                      <td className="num">{e.wavesTotal ?? '—'}</td>
                      <td className="num">{fmtNum(e.toolCallsTotal)}</td>
                      <td className="num">{fmtDur(e.wallclockTotalSeconds)}</td>
                      <td className="num">{e.decisionsTotal ?? '—'}</td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{fmtTimestamp(e.startedAt)}</span></td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-2)' }}>{e.terminationReason ?? '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '4px 12px', color: page === 0 ? 'var(--text-3)' : 'var(--text-1)', cursor: page === 0 ? 'default' : 'pointer' }}>anterior</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>pagina {page + 1}</span>
              <button disabled={items.length < limit} onClick={() => setPage(p => p + 1)} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '4px 12px', color: items.length < limit ? 'var(--text-3)' : 'var(--text-1)', cursor: items.length < limit ? 'default' : 'pointer' }}>proxima</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
