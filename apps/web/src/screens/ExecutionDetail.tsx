/**
 * ExecutionDetail — detalhe de execucao com WavesTimeline + tabs (US2).
 * Tabs: Ondas | Decisoes | Tarefas | Eventos | Alertas | Bloqueios | Skills
 *
 * Campos UNTRUSTED (contexto, justificativa, evidencia, pergunta, etc.)
 * renderizados via TextRaw — nunca dangerouslySetInnerHTML (FR-011, Principio V).
 *
 * Ref: spec.md §User Story 2; tasks.md §6.2
 */
import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  useExecution, useWaves, useDecisions, useTasks,
  useEvents, useAlertsByExecution, useBloqueios, useSkills,
} from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState, DegradedBanner } from '@/states/index.js';
import { StatusBadge, ScoreChip, OutcomePill, TextRaw, Icon } from '@/components/index.js';
import type { ExecutionDTO, WaveDTO, DecisionDTO, TaskDTO, EventDTO, AlertSignalDTO, BloqueioDTO, SkillDTO } from '@cstk-panel/shared-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDur(secs: number | null | undefined): string {
  if (secs == null) return '—';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  return `${Math.floor(secs / 86400)}d`;
}

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

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
    <div>
      <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        {SDD_STAGES.map((s, i) => (
          <div key={s} style={{ flex: 1, background: i <= idx ? color : 'var(--bg-4)', borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {SDD_STAGES.map((s, i) => (
          <div key={s} style={{
            flex: 1, fontSize: 9, color: i === idx ? color : 'var(--text-3)',
            fontFamily: 'var(--font-mono)', textAlign: 'center', overflow: 'hidden',
            textOverflow: 'clip', whiteSpace: 'nowrap',
          }}>
            {s.slice(0, 4)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WavesTimeline
// ---------------------------------------------------------------------------
function WavesTimeline({
  waves, execId, onSelectWave, selectedWave,
}: {
  waves: WaveDTO[];
  execId: string;
  onSelectWave: (wave: string | null) => void;
  selectedWave: string | null;
}) {
  const maxTC = waves.reduce((m, w) => Math.max(m, w.toolCalls ?? 0), 0) || 1;
  const totalTC = waves.reduce((sum, w) => sum + (w.toolCalls ?? 0), 0);
  const totalWS = waves.reduce((sum, w) => sum + (w.wallclockSeconds ?? 0), 0);

  const MOTIVO_COLOR: Record<string, string> = {
    etapa_concluida_avancando: 'var(--success)',
    threshold_proxy_atingido:  'var(--warning)',
    bloqueio_humano:           'var(--info)',
    aborto:                    'var(--critical)',
    concluido:                 'var(--success)',
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="row gap-2">
          <h3>Linha do tempo de ondas</h3>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', padding: '1px 7px', background: 'var(--bg-3)', borderRadius: 10 }}>
            {waves.length}
          </span>
        </div>
        <div className="row gap-2">
          {selectedWave && (
            <button
              onClick={() => onSelectWave(null)}
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '3px 8px', fontSize: 11, color: 'var(--text-1)', cursor: 'pointer' }}
            >
              <Icon name="x" size={10} /> limpar
            </button>
          )}
          <div className="row gap-2" style={{ fontSize: 10.5 }}>
            {[
              { color: 'var(--success)',  label: 'avancou' },
              { color: 'var(--warning)',  label: 'threshold' },
              { color: 'var(--info)',     label: 'bloqueio' },
              { color: 'var(--critical)', label: 'aborto' },
            ].map(({ color, label }) => (
              <div key={label} className="row gap-2" style={{ color: 'var(--text-2)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {/* Header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 120px 1fr 50px 80px',
          gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)',
          fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
        }}>
          <span>Onda</span>
          <span>Etapa</span>
          <span>Tool calls · barra</span>
          <span style={{ textAlign: 'right' }}>Skills</span>
          <span style={{ textAlign: 'right' }}>Wallclock</span>
        </div>
        {waves.map(w => {
          const pct = Math.max(8, ((w.toolCalls ?? 0) / maxTC) * 100);
          const isSelected = selectedWave === w.wave;
          const barColor = MOTIVO_COLOR[w.motivoTermino ?? ''] ?? 'var(--accent)';
          return (
            <div
              key={w.wave}
              onClick={() => onSelectWave(isSelected ? null : w.wave)}
              style={{
                display: 'grid', gridTemplateColumns: '110px 120px 1fr 50px 80px',
                gap: 8, padding: '8px 14px', cursor: 'pointer', alignItems: 'center',
                background: isSelected ? 'var(--bg-2)' : 'transparent',
                borderLeft: isSelected ? `2px solid ${barColor}` : '2px solid transparent',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: isSelected ? 'var(--text-0)' : 'var(--text-1)' }}>
                {w.wave}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--inprogress)' }}>
                {w.etapas ?? '—'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 16, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', background: barColor,
                    borderRadius: 3, display: 'flex', alignItems: 'center', paddingLeft: 6,
                  }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                      {w.toolCalls ?? 0}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {w.motivoTermino?.slice(0, 12) ?? '—'}
                </span>
              </div>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-1)' }}>
                {w.nSkills ?? '—'}
              </span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-1)' }}>
                {fmtDur(w.wallclockSeconds)}
              </span>
            </div>
          );
        })}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '8px 14px', borderTop: '1px solid var(--border)',
          fontSize: 11.5, color: 'var(--text-2)',
        }}>
          <span>{waves.length} ondas</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {fmtNum(totalTC)} tool_calls · {fmtDur(totalWS)} wallclock
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------
function TabBar({
  tabs, activeTab, onChange,
}: {
  tabs: { value: string; label: string; count: number }[];
  activeTab: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid var(--border)',
      padding: '0 4px', background: 'var(--bg-1)',
    }}>
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === t.value ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === t.value ? 'var(--text-0)' : 'var(--text-2)',
            padding: '10px 14px',
            fontSize: 12.5,
            fontWeight: activeTab === t.value ? 600 : 400,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: -1,
          }}
        >
          {t.label}
          {t.count > 0 && (
            <span style={{
              background: 'var(--bg-3)', color: 'var(--text-2)',
              fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
              padding: '1px 5px', borderRadius: 8,
            }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de Decisoes
// ---------------------------------------------------------------------------
function DecisionsPanel({ execucaoId, waveFilter }: { execucaoId: string; waveFilter: string | null }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 20;
  const decOpts: Parameters<typeof useDecisions>[1] = { limit, offset: page * limit };
  if (waveFilter) decOpts.wave = waveFilter;
  const query = useDecisions(execucaoId, decOpts);
  const { isLoading, isError, errorMessage } = useApiState(query);
  const items: DecisionDTO[] = query.data?.data?.decisions ?? [];

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro'} />;
  if (!items.length) return <EmptyState title="Sem decisoes" subtitle="Nenhuma decisao encontrada para os filtros selecionados." />;

  return (
    <div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 28 }} />
            <th>Escolha</th>
            <th>Etapa</th>
            <th>Agente</th>
            <th>Onda</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d, idx) => {
            const key = `${d.wave}-${idx}`;
            const isExp = expanded === key;
            return (
              <>
                <tr key={key} className="clickable" onClick={() => setExpanded(isExp ? null : key)}>
                  <td>
                    <Icon name={isExp ? 'chevron-down' : 'chevron-right'} size={12} style={{ color: 'var(--text-3)' }} />
                  </td>
                  <td><span style={{ color: 'var(--text-0)', fontWeight: 500 }}><TextRaw value={d.escolha} maxLength={60} /></span></td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{d.etapa ?? '—'}</span></td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}><TextRaw value={d.agente} maxLength={32} /></span></td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{d.wave}</span></td>
                  <td><ScoreChip score={d.score} /></td>
                </tr>
                {isExp && (
                  <tr key={`${key}-exp`}>
                    <td colSpan={6} style={{ background: 'var(--bg-2)', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>contexto</div>
                          <TextRaw value={d.contexto} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>justificativa</div>
                          <TextRaw value={d.justificativa} />
                        </div>
                        {d.evidencia && (
                          <div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>evidencia (empirica)</div>
                            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '8px 10px' }}>
                              <TextRaw value={d.evidencia} mono />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {/* Paginacao simples */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
        <button
          disabled={page === 0}
          onClick={() => setPage(p => p - 1)}
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '4px 10px', color: page === 0 ? 'var(--text-3)' : 'var(--text-1)', cursor: page === 0 ? 'default' : 'pointer' }}
        >
          anterior
        </button>
        <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          pagina {page + 1} · {items.length} resultados
        </span>
        <button
          disabled={items.length < limit}
          onClick={() => setPage(p => p + 1)}
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '4px 10px', color: items.length < limit ? 'var(--text-3)' : 'var(--text-1)', cursor: items.length < limit ? 'default' : 'pointer' }}
        >
          proxima
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de Tarefas
// ---------------------------------------------------------------------------
function TasksPanel({ execucaoId }: { execucaoId: string }) {
  const query = useTasks(execucaoId);
  const { isLoading, isError, errorMessage } = useApiState(query);
  const items: TaskDTO[] = query.data?.data?.tasks ?? [];

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro'} />;
  if (!items.length) return <EmptyState title="Sem tarefas registradas" subtitle="Tarefas sao gravadas pelo orquestrador durante execute-task." />;

  const totalTR = items.reduce((a, t) => a + (t.testesRodados ?? 0), 0);
  const totalTP = items.reduce((a, t) => a + (t.testesPassados ?? 0), 0);
  const lintOk  = items.filter(t => t.lintOk).length;
  const fails   = items.filter(t => t.outcome === 'fail').length;

  return (
    <div>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 24 }}>
        {[
          { label: 'Tarefas', value: items.length },
          { label: 'Pass rate', value: totalTR ? `${((totalTP / totalTR) * 100).toFixed(1)}%` : '—', color: fails > 0 ? 'var(--warning)' : 'var(--success)' },
          { label: 'Lint OK', value: `${lintOk}/${items.length}` },
          { label: 'Fails', value: fails, color: fails > 0 ? 'var(--critical)' : 'var(--success)' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: s.color ?? 'var(--text-0)' }}>{String(s.value)}</div>
          </div>
        ))}
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Onda</th>
            <th>Outcome</th>
            <th className="num">Testes</th>
            <th>Lint</th>
            <th className="num">Arquivos tocados</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t, idx) => (
            <tr key={idx}>
              <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{t.wave}</span></td>
              <td><OutcomePill outcome={t.outcome} /></td>
              <td className="num">{t.testesPassados}/{t.testesRodados}</td>
              <td>{t.lintOk
                ? <span className="pill pass">ok</span>
                : <span className="pill fail">falhou</span>}
              </td>
              <td className="num">{t.arquivosTocadosCount ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de Eventos
// ---------------------------------------------------------------------------
const EVENT_META: Record<string, { label: string; color: string; icon: string }> = {
  lock_contention:   { label: 'lock_contention',   color: 'var(--warning)',  icon: 'clock' },
  validation_failed: { label: 'validation_failed', color: 'var(--critical)', icon: 'alert' },
  wave_retry:        { label: 'wave_retry',         color: 'var(--info)',     icon: 'activity' },
  schedule_wait:     { label: 'schedule_wait',      color: 'var(--text-2)',   icon: 'clock' },
};

function EventsPanel({ execucaoId }: { execucaoId: string }) {
  const query = useEvents(execucaoId);
  const { isLoading, isError, errorMessage } = useApiState(query);
  const items: EventDTO[] = query.data?.data ?? [];

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro'} />;
  if (!items.length) return <EmptyState title="Sem eventos de timeline" subtitle="Eventos sao lock_contention, validation_failed, wave_retry, schedule_wait." />;

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((e, idx) => {
        const m = EVENT_META[e.eventType] ?? { label: e.eventType, color: 'var(--text-2)', icon: 'zap' };
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 90, fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {fmtTimestamp(e.timestamp)}
            </div>
            <div>
              <div className="row gap-2" style={{ marginBottom: 2 }}>
                <Icon name={m.icon} size={12} style={{ color: m.color }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: m.color, fontWeight: 600 }}>{m.label}</span>
              </div>
              {e.descricao && (
                <div style={{ fontSize: 12.5, color: 'var(--text-1)' }}>
                  <TextRaw value={e.descricao} maxLength={200} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de Alertas (por execucao)
// ---------------------------------------------------------------------------
function AlertsPanel({ execucaoId }: { execucaoId: string }) {
  const query = useAlertsByExecution(execucaoId);
  const { isLoading, isError, errorMessage } = useApiState(query);
  const items: AlertSignalDTO[] = query.data?.data ?? [];

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro'} />;
  if (!items.length) return <EmptyState title="Sem alertas nesta execucao" subtitle="Tudo sob controle." />;

  return (
    <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {items.map((a, idx) => {
        const isCircular = a.tipo === 'circular';
        const sevColor = a.descricao?.includes('critical') ? 'var(--critical)' : 'var(--warning)';
        const pct = a.valorConsumido != null && a.valorThreshold != null && a.valorThreshold > 0
          ? Math.min(100, Math.round((a.valorConsumido / a.valorThreshold) * 100))
          : null;
        return (
          <div key={idx} style={{
            background: 'var(--bg-2)', padding: 14, borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
          }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="row gap-2">
                <Icon name={isCircular ? 'activity' : 'alert'} size={14} style={{ color: sevColor }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-0)' }}>
                  {isCircular ? 'movimento circular' : `breach · ${a.subtipo ?? '?'}`}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{a.wave}</span>
            </div>
            {a.descricao && (
              <div style={{ fontSize: 12.5, color: 'var(--text-1)', marginBottom: 10 }}>
                <TextRaw value={a.descricao} maxLength={160} />
              </div>
            )}
            {pct != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: sevColor, borderRadius: 3 }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-1)' }}>
                  {a.valorConsumido} / {a.valorThreshold} ({pct}%)
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de Bloqueios
// ---------------------------------------------------------------------------
function BloqueiosPanel({ execucaoId }: { execucaoId: string }) {
  const query = useBloqueios(execucaoId);
  const { isLoading, isError, errorMessage } = useApiState(query);
  const items: BloqueioDTO[] = query.data?.data ?? [];

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro'} />;
  if (!items.length) return <EmptyState title="Sem bloqueios humanos" subtitle="Nenhum BloqueioHumano foi registrado nesta execucao." />;

  const STATUS_COLOR: Record<string, string> = {
    pendente:   'var(--warning)',
    respondido: 'var(--success)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((b, idx) => {
        const color = STATUS_COLOR[b.status ?? ''] ?? 'var(--text-2)';
        return (
          <div key={idx} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="row gap-2">
                <Icon name="users" size={13} style={{ color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: 'var(--font-mono)' }}>
                  {b.status ?? 'desconhecido'}
                </span>
                {b.decisaoId && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    ref: {b.decisaoId}
                  </span>
                )}
              </div>
              <div className="row gap-2" style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {b.latenciaSegundos != null && (
                  <span>latencia: {fmtDur(b.latenciaSegundos)}</span>
                )}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>pergunta</div>
              <TextRaw value={b.pergunta} />
            </div>
            {b.contextoParaResposta && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>contexto para humano</div>
                <TextRaw value={b.contextoParaResposta} />
              </div>
            )}
            {b.resposta && (
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>resposta</div>
                <div style={{ background: 'var(--success-soft)', borderRadius: 'var(--r-xs)', padding: '6px 10px', fontSize: 12.5 }}>
                  <TextRaw value={b.resposta} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel de Skills
// ---------------------------------------------------------------------------
function SkillsPanel({ execucaoId }: { execucaoId: string }) {
  const query = useSkills(execucaoId);
  const { isLoading, isError, errorMessage } = useApiState(query);
  const items: SkillDTO[] = query.data?.data ?? [];

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro'} />;
  if (!items.length) return <EmptyState title="Sem invocacoes de skill" subtitle="Nenhuma skill foi registrada com record-skill nesta execucao." />;

  // Agregar por skill_name
  const counts = items.reduce<Record<string, number>>((acc, s) => {
    acc[s.skillName] = (acc[s.skillName] ?? 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const maxCount = sorted[0]?.[1] ?? 1;

  return (
    <div>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(([name, count]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 160, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-1)', flexShrink: 0 }}>
              {name}
            </div>
            <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: 'var(--info)', borderRadius: 3 }} />
            </div>
            <div style={{ width: 30, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-0)', fontWeight: 600, flexShrink: 0 }}>
              {count}
            </div>
          </div>
        ))}
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Onda</th>
            <th>Decisao ref.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, idx) => (
            <tr key={idx}>
              <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--info)' }}>{s.skillName}</span></td>
              <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{s.wave}</span></td>
              <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{s.decisaoId ?? '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExecutionDetail — componente principal
// ---------------------------------------------------------------------------
export function ExecutionDetail() {
  const { execucaoId } = useParams<{ execucaoId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedWave, setSelectedWave] = useState<string | null>(searchParams.get('wave'));
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') ?? 'decisions');

  const execQuery = useExecution(execucaoId ?? '');
  const wavesQuery = useWaves(execucaoId ?? '');
  const { isLoading, isError, errorMessage, isDegraded } = useApiState(execQuery);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={errorMessage ?? 'Erro ao carregar execucao.'} />;

  const exec: ExecutionDTO | null = execQuery.data?.data ?? null;
  const meta = execQuery.data?.meta;
  const waves: WaveDTO[] = wavesQuery.data?.data ?? [];

  if (!exec) return <EmptyState title="Execucao nao encontrada" subtitle="O execucao_id informado nao existe na base." />;

  function handleSelectWave(wave: string | null) {
    setSelectedWave(wave);
    const params = new URLSearchParams(searchParams);
    if (wave) params.set('wave', wave); else params.delete('wave');
    setSearchParams(params, { replace: true });
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params, { replace: true });
  }

  const tabs = [
    { value: 'decisions', label: 'Decisoes',  count: exec.decisoesTotal ?? 0 },
    { value: 'tasks',     label: 'Tarefas',   count: 0 },
    { value: 'events',    label: 'Eventos',   count: 0 },
    { value: 'alerts',    label: 'Alertas',   count: 0 },
    { value: 'bloqueios', label: 'Bloqueios', count: exec.bloqueiosHumanosTotal ?? 0 },
    { value: 'skills',    label: 'Skills',    count: 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isDegraded && meta && <DegradedBanner meta={meta} />}

      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div className="row gap-2" style={{ marginBottom: 4 }}>
                <StatusBadge status={exec.status} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>execucao</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>
                  {exec.execucaoId}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                {exec.feature ?? exec.execucaoId}
              </div>
              <div className="row gap-2" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                <span
                  onClick={() => navigate(`/projects/${encodeURIComponent(exec.project)}`)}
                  style={{ cursor: 'pointer', color: 'var(--text-1)' }}
                >
                  {exec.project}
                </span>
                <span style={{ color: 'var(--text-3)' }}>/</span>
                <span>{exec.feature}</span>
                <span style={{ color: 'var(--text-3)' }}>·</span>
                <span>iniciada {fmtTimestamp(exec.iniciadaEm)}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Etapa corrente',  value: exec.etapaCorrente ?? '—', color: exec.status === 'em_andamento' ? 'var(--inprogress)' : 'var(--text-0)', mono: true },
              { label: 'Duracao',         value: fmtDur(exec.duracaoSegundos) },
              { label: 'Custo · proxy',   value: fmtNum(exec.toolCallsTotal) },
              { label: 'Ondas',           value: String(exec.ondasTotal ?? '—') },
              { label: 'Subagentes',      value: String(exec.subagentesSpawned ?? '—') },
              { label: 'Prof. maxima',    value: String(exec.profundidadeMax ?? '—') },
              { label: 'Decisoes',        value: String(exec.decisoesTotal ?? '—') },
              { label: 'Bloqueios',       value: String(exec.bloqueiosHumanosTotal ?? '—') },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
                <div style={{
                  fontFamily: s.mono ? 'var(--font-mono)' : 'inherit',
                  fontSize: 14, fontWeight: 700, color: s.color ?? 'var(--text-0)',
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <PipelineProgress etapa={exec.etapaCorrente} status={exec.status} />

          {exec.stackSugerida && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              {exec.stackSugerida.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                <span key={s} style={{
                  padding: '2px 7px', borderRadius: 8, fontSize: 11,
                  background: 'var(--bg-3)', color: 'var(--text-1)',
                  border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
                }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Waves timeline */}
      <WavesTimeline
        waves={waves}
        execId={execucaoId ?? ''}
        selectedWave={selectedWave}
        onSelectWave={handleSelectWave}
      />

      {/* Tabs */}
      <div className="card">
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        <div>
          {activeTab === 'decisions' && <DecisionsPanel execucaoId={execucaoId ?? ''} waveFilter={selectedWave} />}
          {activeTab === 'tasks'     && <TasksPanel execucaoId={execucaoId ?? ''} />}
          {activeTab === 'events'    && <EventsPanel execucaoId={execucaoId ?? ''} />}
          {activeTab === 'alerts'    && <AlertsPanel execucaoId={execucaoId ?? ''} />}
          {activeTab === 'bloqueios' && <BloqueiosPanel execucaoId={execucaoId ?? ''} />}
          {activeTab === 'skills'    && <SkillsPanel execucaoId={execucaoId ?? ''} />}
        </div>
      </div>
    </div>
  );
}
