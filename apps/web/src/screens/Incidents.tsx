/**
 * Incidents — timeline global de eventos operacionais (tela Incidentes,
 * prototipo screens_aux.jsx). KPIs por tipo + timeline agrupada por data.
 * Dados reais de /events.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventsList } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState } from '@/states/index.js';
import { KpiCard, Icon } from '@/components/index.js';
import { fmtTimestamp } from '@/lib/format.js';

interface EventRow {
  execucaoId: string;
  project: string;
  feature: string;
  eventType: string;
  timestamp: string;
  descricao: string | null;
}

const EVENT_META: Record<string, { icon: string; color: string; label: string }> = {
  lock_contention: { icon: 'lock', color: 'var(--critical)', label: 'lock contention' },
  validation_failed: { icon: 'cancel', color: 'var(--warning)', label: 'validation failed' },
  wave_retry: { icon: 'retry', color: 'var(--info)', label: 'wave retry' },
  schedule_wait: { icon: 'wait', color: 'var(--text-2)', label: 'schedule wait' },
};
const TYPES = ['lock_contention', 'validation_failed', 'wave_retry', 'schedule_wait'] as const;

export function Incidents() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const query = useEventsList();
  const { isLoading, isError, errorMessage, isEmpty } = useApiState(query);

  if (isLoading) return <LoadingState variant="kpi" />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar incidentes.'} />;
  if (isEmpty) return <EmptyState title="Nenhum incidente" subtitle="Sem eventos operacionais registrados." />;

  const all = ((query.data?.data as { events?: EventRow[] } | null)?.events ?? []);
  const countOf = (t: string) => all.filter(e => e.eventType === t).length;
  const counts = {
    lock_contention: countOf('lock_contention'),
    validation_failed: countOf('validation_failed'),
    wave_retry: countOf('wave_retry'),
    schedule_wait: countOf('schedule_wait'),
  };

  const filtered = typeFilter === 'all' ? all : all.filter(e => e.eventType === typeFilter);
  // Agrupar por data (desc).
  const groups = new Map<string, EventRow[]>();
  for (const e of filtered) {
    const day = (e.timestamp ?? '').slice(0, 10) || '—';
    const arr = groups.get(day) ?? [];
    arr.push(e);
    groups.set(day, arr);
  }
  const sortedDates = [...groups.keys()].sort().reverse();

  return (
    <div className="col gap-4">
      <div className="page-head">
        <div>
          <h1>Incidentes</h1>
          <div className="sub">{all.length} eventos operacionais · timeline global</div>
        </div>
      </div>

      <div className="grid-4">
        <KpiCard label="lock_contention" value={counts.lock_contention} icon="lock" accent={counts.lock_contention > 1 ? 'critical' : undefined} />
        <KpiCard label="validation_failed" value={counts.validation_failed} icon="cancel" accent={counts.validation_failed > 0 ? 'warning' : undefined} />
        <KpiCard label="wave_retry" value={counts.wave_retry} icon="retry" />
        <KpiCard label="schedule_wait" value={counts.schedule_wait} icon="wait" />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Timeline global</h3>
          <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filtrar por tipo">
            <option value="all">Todos os tipos</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="card-pad">
          {sortedDates.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: 16 }}>Nenhum evento para este filtro.</div>
          ) : sortedDates.map(date => (
            <div key={date} style={{ marginBottom: 24 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-0)' }}>{date}</div>
                <span className="mono muted" style={{ fontSize: 11 }}>{groups.get(date)!.length} eventos</span>
              </div>
              <div className="events">
                {groups.get(date)!.map((e, i) => {
                  const m = EVENT_META[e.eventType] ?? { icon: 'zap', color: 'var(--text-2)', label: e.eventType };
                  return (
                    <div
                      key={i}
                      className={`event ${e.eventType}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/executions/${encodeURIComponent(e.execucaoId)}?tab=events`)}
                    >
                      <span className="time">{fmtTimestamp(e.timestamp)}</span>
                      <div>
                        <div className="row gap-2" style={{ marginBottom: 2 }}>
                          <Icon name={m.icon} size={12} style={{ color: m.color }} />
                          <span className="mono" style={{ fontSize: 11.5, color: m.color, fontWeight: 600 }}>{m.label}</span>
                          <span className="prov" style={{ fontSize: 10.5 }}>
                            <span>{e.project}</span><span className="sep">/</span><span>{e.feature}</span>
                          </span>
                        </div>
                        <div className="body">{e.descricao ?? '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
