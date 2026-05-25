/**
 * Tasks — tarefas cross-execucao (tela Tarefas, prototipo screens_aux.jsx).
 * KPIs + tabela com filtro de outcome. Dados reais de /tasks.
 *
 * Nota de honestidade: a tabela `tasks` (schema v2) nao tem titulo de tarefa;
 * usamos feature/onda como identidade. Series temporais de pass/fail vivem em
 * Metricas (nao reproduzimos os graficos mock do prototipo aqui).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasksList } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import { KpiCard, OutcomePill } from '@/components/index.js';
import { fmtNum, fmtPct } from '@/lib/format.js';

type Outcome = 'all' | 'pass' | 'fail';

interface TaskRow {
  wave: string;
  execucaoId: string;
  project: string;
  feature: string;
  outcome: 'pass' | 'fail' | null;
  testesRodados: number | null;
  testesPassados: number | null;
  lintOk: boolean | null;
  arquivosTocadosCount: number | null;
}

export function Tasks() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Outcome>('all');
  const query = useTasksList();
  const { isLoading, isError, errorMessage, isEmpty } = useApiState(query);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar tarefas.'} />;
  if (isEmpty) return <EmptyState title="Nenhuma tarefa" subtitle="Execute o orquestrador para ver dados aqui." />;

  const all = ((query.data?.data as { tasks?: TaskRow[] } | null)?.tasks ?? []);
  const filtered = filter === 'all' ? all : all.filter(t => t.outcome === filter);

  const total = all.length;
  const fails = all.filter(t => t.outcome === 'fail').length;
  const tr = all.reduce((a, t) => a + (t.testesRodados ?? 0), 0);
  const tp = all.reduce((a, t) => a + (t.testesPassados ?? 0), 0);
  const withLint = all.filter(t => t.lintOk != null);
  const lintPct = withLint.length > 0 ? withLint.filter(t => t.lintOk).length / withLint.length : null;
  const avgFiles = total > 0 ? (all.reduce((a, t) => a + (t.arquivosTocadosCount ?? 0), 0) / total).toFixed(1) : '—';
  const passRate = tr > 0 ? tp / tr : null;

  return (
    <div className="col gap-4">
      <div className="page-head">
        <div>
          <h1>Tarefas</h1>
          <div className="sub">{total} tarefas executadas · testes, lint e arquivos tocados</div>
        </div>
      </div>

      <div className="grid-5">
        <KpiCard label="Tasks · total" value={total} icon="check" />
        <KpiCard label="Pass rate · testes" value={passRate != null ? fmtPct(passRate, 1) : '—'} accent={passRate === 1 ? 'success' : undefined} footnote={`${fmtNum(tp)} / ${fmtNum(tr)}`} />
        <KpiCard label="Fails" value={fails} icon="cancel" accent={fails > 0 ? 'critical' : undefined} />
        <KpiCard label="Lint OK" value={lintPct != null ? fmtPct(lintPct) : '—'} icon="check" />
        <KpiCard label="Arquivos tocados · média" value={avgFiles} icon="doc" />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Tarefas</h3>
          <div className="period-tabs" role="tablist">
            {(['all', 'pass', 'fail'] as Outcome[]).map(o => (
              <button key={o} className={filter === o ? 'active' : ''} onClick={() => setFilter(o)}>
                {o === 'all' ? 'todas' : o}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Tarefa</th>
                <th>Proveniência</th>
                <th>Outcome</th>
                <th className="num">Testes</th>
                <th>Lint</th>
                <th className="num">Arquivos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>Nenhuma tarefa.</td></tr>
              ) : filtered.map((t, idx) => (
                <tr key={`${t.execucaoId}/${t.wave}/${idx}`} className="clickable" onClick={() => navigate(`/executions/${encodeURIComponent(t.execucaoId)}?tab=tasks`)}>
                  <td>
                    <div style={{ color: 'var(--text-0)' }}>{t.feature} · {t.wave}</div>
                    <div className="mono muted-2" style={{ fontSize: 10.5 }}>{t.execucaoId.slice(0, 40)}</div>
                  </td>
                  <td>
                    <span className="prov">
                      <span>{t.project}</span><span className="sep">/</span><span>{t.feature}</span><span className="sep">/</span><span>{t.wave}</span>
                    </span>
                  </td>
                  <td>{t.outcome ? <OutcomePill outcome={t.outcome} /> : <span className="muted">—</span>}</td>
                  <td className="num">{t.testesPassados ?? '—'}/{t.testesRodados ?? '—'}</td>
                  <td>{t.lintOk == null ? <span className="muted">—</span> : t.lintOk ? <span className="pill pass">✓ ok</span> : <span className="pill fail">✕ falhou</span>}</td>
                  <td className="num">{t.arquivosTocadosCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
