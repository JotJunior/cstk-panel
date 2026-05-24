/**
 * KpiCard — cartao de metrica principal (valor, label, tendencia opcional).
 * Ref: spec.md FR-021; data-model.md §Entities
 */
interface KpiCardProps {
  label: string;
  value: string | number;
  /** Tendencia: texto como "+12%" ou "estavel" */
  trend?: string;
  /** Destaque visual: accent, success, warning, critical */
  accent?: 'accent' | 'success' | 'warning' | 'critical';
}

const ACCENT_VAR: Record<string, string> = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
};

export function KpiCard({ label, value, trend, accent }: KpiCardProps) {
  const color = accent ? ACCENT_VAR[accent] : 'var(--text-0)';
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>
        {value}
      </div>
      {trend && <div className="kpi-trend">{trend}</div>}
    </div>
  );
}
