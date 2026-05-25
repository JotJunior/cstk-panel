/**
 * Charts SVG puros — portados do prototipo
 * (docs/06-ui-ux-design/castk-panel/project/components.jsx).
 *
 * Sem dependencia de libs de grafico; SVG inline com tokens de cor.
 */
import { fmtNum } from '@/lib/format.js';

// ---------------------------------------------------------------------------
// Sparkline — mini linha de tendencia (usada em KPI de custo)
// ---------------------------------------------------------------------------
export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({ data, width = 96, height = 28, color = 'currentColor', fill = true }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / rng) * (height - 4);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${path} L${width - 1},${height - 1} L1,${height - 1} Z`;
  return (
    <svg width={width} height={height} style={{ color }} aria-hidden>
      {fill && <path className="spark-fill" d={area} />}
      <path className="spark-path" d={path} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Donut — distribuicao categorica (ex: mix de modelos)
// ---------------------------------------------------------------------------
export interface DonutDatum { label: string; value: number; color: string; }
export interface DonutProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function Donut({ data, size = 132, thickness = 20, centerLabel, centerValue }: DonutProps) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={thickness} />
      {data.map((d, i) => {
        const frac = d.value / total;
        const dash = `${frac * c} ${c}`;
        const offset = -acc * c;
        acc += frac;
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={dash}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
      })}
      {centerValue && (
        <>
          <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fill="var(--text-0)" fontSize="20" fontWeight="600" fontFamily="var(--font-mono)">{centerValue}</text>
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fill="var(--text-2)" fontSize="11">{centerLabel}</text>
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// BarH — barras horizontais (ex: custo por feature, skills)
// ---------------------------------------------------------------------------
export interface BarHDatum { label: string; value: number; color?: string; }
export interface BarHProps {
  data: BarHDatum[];
  maxLabel?: number;
  valueFmt?: (n: number) => string;
  /** Escala explicita (ex: alinhar varias listas); senao usa o maior do data. */
  max?: number;
}

export function BarH({ data, maxLabel = 160, valueFmt = fmtNum, max: maxProp }: BarHProps) {
  const max = (maxProp && maxProp > 0 ? maxProp : Math.max(...data.map(d => d.value), 0)) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `${maxLabel}px 1fr 48px`, gap: 10, alignItems: 'center' }}>
          <div style={{ color: 'var(--text-1)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.label}>{d.label}</div>
          <div style={{ height: 14, background: 'var(--bg-2)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(d.value / max) * 100}%`, background: d.color || 'var(--accent)', borderRadius: 4, opacity: 0.9 }} />
          </div>
          <div className="mono" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-0)' }}>{valueFmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FunnelChart — features por etapa corrente (SDD, 9 etapas)
// ---------------------------------------------------------------------------
export interface FunnelDatum { label: string; count: number; }

export function FunnelChart({ data }: { data: FunnelDatum[] }) {
  const max = Math.max(...data.map(d => d.count), 0) || 1;
  return (
    <div className="funnel">
      {data.map((d, i) => (
        <div className="funnel-row" key={i}>
          <span className="label" title={d.label}>{d.label}</span>
          <div className="bar"><div className="bar-fill" style={{ width: `${(d.count / max) * 100}%`, opacity: 0.4 + (d.count / max) * 0.6 }} /></div>
          <span className="count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
