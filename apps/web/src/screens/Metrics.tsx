/**
 * Metrics — Metricas Agregadas (US5).
 * 8 metricas via endpoints /metrics/<name>.
 * Principio III: eixo-y de custo rotulado "proxy: tool calls" (SC-002).
 * dec-020: "mix de modelos" indisponivel nesta fonte — card especial.
 * clarify-resolution: badge "derivada/aproximada" quando meta.approximate=true.
 *
 * Ref: spec.md §User Story 5; tasks.md §6.5; dec-020
 */
import { useMetric } from '@/lib/hooks.js';
import { useApiState } from '@/hooks/useApiState.js';
import { LoadingState, EmptyState, ErrorState, DegradedBanner } from '@/states/index.js';
import { KpiCard, Icon } from '@/components/index.js';
import type { PeriodParam } from '@cstk-panel/shared-types';

interface MetricsProps {
  period: PeriodParam;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDur(secs: number | null | undefined): string {
  if (secs == null) return '—';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null) return '—';
  const v = n > 1 ? n : n * 100; // aceita 0..1 ou 0..100
  return `${v.toFixed(digits)}%`;
}

// ---------------------------------------------------------------------------
// Mini charts (SVG simples — sem dep externa)
// ---------------------------------------------------------------------------

interface TimeSeriesPoint { d?: string; date?: string; value?: number; v?: number; count?: number }

function AreaChart({ data, height = 120, color = 'var(--accent)', label = '' }: {
  data: TimeSeriesPoint[];
  height?: number;
  color?: string;
  label?: string;
}) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>
        Sem dados suficientes
      </div>
    );
  }

  const values = data.map(d => d.value ?? d.v ?? d.count ?? 0);
  const maxV = Math.max(...values) || 1;
  const w = 400;
  const h = height - 20;
  const step = w / (values.length - 1);

  const pts = values.map((v, i) => ({ x: i * step, y: h - (v / maxV) * h }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${(values.length - 1) * step},${h} L0,${h} Z`;

  return (
    <div>
      {label && (
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', textAlign: 'right', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
          {label}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height, overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${color.replace(/[^a-z]/gi, '')})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}
      </svg>
    </div>
  );
}

function BarH({ data, label = '' }: { data: { label: string; value: number }[]; label?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      {label && <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{label}</div>}
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <div style={{ width: 90, fontSize: 10.5, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
          </div>
          <div style={{ width: 40, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-1)', flexShrink: 0 }}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartao "Indisponivel nesta fonte" (dec-020 — mix de modelos)
// ---------------------------------------------------------------------------
function UnavailableCard({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="card" style={{ opacity: 0.75 }}>
      <div className="card-head">
        <h3>{title}</h3>
        <span style={{
          padding: '2px 7px', borderRadius: 8, fontSize: 10.5, fontWeight: 600,
          fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', color: 'var(--text-3)',
        }}>
          indisponivel
        </span>
      </div>
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Icon name="database" size={24} style={{ color: 'var(--text-3)' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
          Indisponivel nesta fonte
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', maxWidth: 280 }}>
          {reason}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartao de metrica generico com hook
// ---------------------------------------------------------------------------
function MetricCard({
  name, title, subtitle, period, renderContent, span = 1,
}: {
  name: Parameters<typeof useMetric>[0];
  title: string;
  subtitle?: string;
  period?: PeriodParam;
  renderContent: (data: unknown, meta: { approximate?: boolean }) => React.ReactNode;
  span?: number;
}) {
  const query = useMetric(name, period);
  const { isLoading, isError, errorMessage } = useApiState(query);
  const raw = query.data?.data;
  const metaRaw = query.data?.meta;
  const metaRecord = metaRaw as unknown as Record<string, unknown> | null;
  const approximate = (metaRecord?.approximate as boolean | undefined) ?? false;

  return (
    <div className="card" style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
      <div className="card-head">
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {title}
            {approximate && (
              <span style={{
                padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                fontFamily: 'var(--font-mono)', background: 'var(--warning-soft)', color: 'var(--warning)',
              }}>
                derivada/aproximada
              </span>
            )}
          </h3>
          {subtitle && <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div className="card-body">
        {isLoading && <LoadingState />}
        {isError && <ErrorState message={errorMessage ?? 'Erro ao carregar metrica.'} />}
        {!isLoading && !isError && (raw == null || (Array.isArray(raw) && raw.length === 0))
          ? <EmptyState title="Sem dados" subtitle="Nenhum dado para este periodo." />
          : null}
        {!isLoading && !isError && raw != null && (
          !Array.isArray(raw) || (raw as unknown[]).length > 0
            ? renderContent(raw, { approximate })
            : null
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics principal
// ---------------------------------------------------------------------------
export function Metrics({ period }: MetricsProps) {
  // Buscar KPI summary de custo e test-pass para o topo
  const costQuery = useMetric('cost-over-time', period);
  const testQuery = useMetric('test-pass-rate', period);
  const latencyQuery = useMetric('human-latency', period);
  const clarifyQuery = useMetric('clarify-resolution', period);

  const { isDegraded } = useApiState(costQuery);
  const meta = costQuery.data?.meta;

  const costData = costQuery.data?.data as Record<string, unknown> | null;
  const testData = testQuery.data?.data as Record<string, unknown> | null;
  const latData  = latencyQuery.data?.data as Record<string, unknown> | null;
  const clarData = clarifyQuery.data?.data as Record<string, unknown> | null;
  const clarMetaRaw = clarifyQuery.data?.meta;
  const clarMetaApprox = (clarMetaRaw as unknown as Record<string, unknown> | null);

  // KPIs summary
  const totalToolCalls = (costData?.total as number | null) ?? null;
  const passRate       = (testData?.pass_rate as number | null) ?? null;
  const latP50         = (latData?.p50 as number | null) ?? null;
  const autoResolve    = (clarData?.auto_resolve_rate as number | null) ?? null;
  const isApproximate  = (clarMetaApprox?.approximate as boolean | undefined) ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isDegraded && meta && <DegradedBanner meta={meta} />}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        <KpiCard
          label="Custo total · proxy"
          value={totalToolCalls != null ? String(totalToolCalls) : '—'}
          trend="tool_calls (nao tokens)"
        />
        {passRate != null && passRate >= 0.8 ? (
          <KpiCard label="Test pass rate" value={fmtPct(passRate)} trend="media do periodo" accent="success" />
        ) : passRate != null ? (
          <KpiCard label="Test pass rate" value={fmtPct(passRate)} trend="media do periodo" accent="warning" />
        ) : (
          <KpiCard label="Test pass rate" value={fmtPct(passRate)} trend="media do periodo" />
        )}
        <KpiCard
          label="Latencia humana p50"
          value={fmtDur(latP50)}
          trend="tempo de resposta a bloqueios"
        />
        {autoResolve != null && autoResolve >= 0.7 ? (
          <KpiCard label="Auto-resolve clarify" value={fmtPct(autoResolve)} trend={isApproximate ? 'derivada/aproximada' : 'score>=2 vs escalados'} accent="success" />
        ) : (
          <KpiCard label="Auto-resolve clarify" value={fmtPct(autoResolve)} trend={isApproximate ? 'derivada/aproximada' : 'score>=2 vs escalados'} />
        )}
      </div>

      {/* Grid de metricas 2x4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>

        {/* 1. cost-over-time */}
        <MetricCard
          name="cost-over-time"
          title="Custo no tempo · proxy"
          subtitle="proxy: tool calls por dia"
          period={period}
          renderContent={(raw) => {
            const data = Array.isArray(raw) ? raw as TimeSeriesPoint[] : [];
            return (
              <>
                <AreaChart data={data} color="var(--accent)" height={140} label="tool_calls / dia (proxy — nao tokens)" />
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  {data.length} pontos · eixo-y = proxy: tool calls · nao $ / tokens
                </div>
              </>
            );
          }}
        />

        {/* 2. test-pass-rate */}
        <MetricCard
          name="test-pass-rate"
          title="Test pass rate"
          subtitle="% de testes passando por dia"
          period={period}
          renderContent={(raw) => {
            const data = Array.isArray(raw) ? raw as TimeSeriesPoint[] : [];
            return <AreaChart data={data} color="var(--success)" height={140} />;
          }}
        />

        {/* 3. throughput-by-stage */}
        <MetricCard
          name="throughput-by-stage"
          title="Throughput por etapa"
          subtitle="soma tool_calls por etapa SDD"
          renderContent={(raw) => {
            const arr = Array.isArray(raw)
              ? (raw as Record<string, unknown>[]).map(r => ({
                  label: (r.etapa as string | null) ?? (r.stage as string | null) ?? '?',
                  value: (r.tool_calls as number | null) ?? (r.count as number | null) ?? 0,
                }))
              : [];
            return <BarH data={arr} />;
          }}
        />

        {/* 4. human-latency */}
        <MetricCard
          name="human-latency"
          title="Latencia humana"
          subtitle="tempo de resposta a bloqueios"
          period={period}
          renderContent={(raw) => {
            const d = raw as Record<string, unknown> | null;
            if (!d) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'p50', value: fmtDur(d.p50 as number | null) },
                  { label: 'p95', value: fmtDur(d.p95 as number | null) },
                  { label: 'max', value: fmtDur(d.max as number | null) },
                  { label: 'count', value: String(d.count ?? '—') },
                  { label: 'pendentes', value: String(d.pending ?? '—') },
                  { label: 'respondidos', value: String(d.resolved ?? '—') },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-0)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            );
          }}
        />

        {/* 5. clarify-resolution — com badge "derivada/aproximada" */}
        <MetricCard
          name="clarify-resolution"
          title="Clarify auto-resolution"
          subtitle="score>=2 vs escalados a humano"
          period={period}
          renderContent={(raw, { approximate }) => {
            const d = raw as Record<string, unknown> | null;
            if (!d) return null;
            const autoRate = (d.auto_resolve_rate as number | null);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {approximate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--warning-soft)', borderRadius: 'var(--r-xs)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <Icon name="alert" size={12} style={{ color: 'var(--warning)' }} />
                    <span style={{ fontSize: 11.5, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                      metrica derivada/aproximada
                    </span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Auto-resolvidas', value: String(d.auto_resolved ?? '—'), color: 'var(--success)' },
                    { label: 'Escaladas', value: String(d.escalated ?? '—'), color: 'var(--warning)' },
                    { label: 'Taxa auto', value: fmtPct(autoRate), color: autoRate != null && autoRate >= 0.7 ? 'var(--success)' : 'var(--warning)' },
                    { label: 'Total clarify', value: String(d.total ?? '—') },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: s.color ?? 'var(--text-0)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        />

        {/* 6. decisions-by-score */}
        <MetricCard
          name="decisions-by-score"
          title="Decisoes por score"
          subtitle="distribuicao 0..3 de autonomia"
          period={period}
          renderContent={(raw) => {
            const arr = Array.isArray(raw)
              ? (raw as Record<string, unknown>[])
              : Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({ score: parseInt(k), count: v, value: v }));
            const max = Math.max(...arr.map(d => ((d.count ?? d.value ?? 0) as number)), 1);
            const COLORS = ['var(--score-0)', 'var(--score-1)', 'var(--score-2)', 'var(--score-3)'];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {arr.map((d, i) => {
                  const score = (d.score as number | null) ?? i;
                  const count = ((d.count ?? (d as Record<string, unknown>).value) as number | null) ?? 0;
                  return (
                    <div key={score} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 4, fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)', background: `${COLORS[score]}22`, color: COLORS[score],
                        flexShrink: 0,
                      }}>
                        {score}
                      </span>
                      <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: COLORS[score], borderRadius: 3 }} />
                      </div>
                      <span style={{ width: 30, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-0)', fontWeight: 600, flexShrink: 0 }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }}
        />

        {/* 7. execution-duration */}
        <MetricCard
          name="execution-duration"
          title="Duracao das execucoes"
          subtitle="distribuicao de wallclock_segundos"
          period={period}
          renderContent={(raw) => {
            const d = raw as Record<string, unknown> | null;
            if (!d) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'p50', value: fmtDur(d.p50 as number | null) },
                  { label: 'p95', value: fmtDur(d.p95 as number | null) },
                  { label: 'max', value: fmtDur(d.max as number | null) },
                  { label: 'media', value: fmtDur(d.mean as number | null) },
                  { label: 'concluidas', value: String(d.completed ?? '—') },
                  { label: 'abortadas', value: String(d.aborted ?? '—') },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            );
          }}
        />

        {/* 8. depth-subagents — disponivel */}
        <MetricCard
          name="depth-subagents"
          title="Profundidade de subagentes"
          subtitle="distribuicao de profundidade_max e subagentes_spawned"
          period={period}
          renderContent={(raw) => {
            const d = raw as Record<string, unknown> | null;
            if (!d) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {[
                  { label: 'Prof. media', value: String((d.avg_depth as number | null)?.toFixed(1) ?? '—') },
                  { label: 'Prof. maxima', value: String(d.max_depth ?? '—') },
                  { label: 'Spawns media', value: String((d.avg_spawned as number | null)?.toFixed(1) ?? '—') },
                  { label: 'Spawns total', value: String(d.total_spawned ?? '—') },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-0)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            );
          }}
        />
      </div>

      {/* Mix de modelos — INDISPONIVEL nesta fonte (dec-020, Principio IV, D3 Opcao A) */}
      <UnavailableCard
        title="Mix de modelos por execucao"
        reason="A harness do Claude Code nao expoe rastreamento de modelo por invocacao. O campo 'escolha' de decisoes model-routing reflete intencao do orquestrador, nao confirmacao da harness. Metrica indisponivel nesta fonte. (Principio IV, dec-020, D3 Opcao A)"
      />
    </div>
  );
}
