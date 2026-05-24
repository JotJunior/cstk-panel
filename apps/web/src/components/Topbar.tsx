/**
 * Topbar — altura 52px, sticky, breadcrumb + seletor de periodo.
 * Ref: spec.md FR-021, FR-022; prototipo styles.css .topbar
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon.js';
import { Breadcrumb } from './Breadcrumb.js';
import type { PeriodParam } from '@cstk-panel/shared-types';

export type Period = PeriodParam;

interface TopbarProps {
  period: Period;
  onPeriodChange: (p: Period) => void;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: 'tudo', value: 'all' },
];

export function Topbar({ period, onPeriodChange }: TopbarProps) {
  const navigate = useNavigate();

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = (e.currentTarget as HTMLInputElement).value.trim();
      if (val) {
        navigate(`/search?q=${encodeURIComponent(val)}`);
      }
    }
  }

  return (
    <header className="topbar">
      <Breadcrumb />

      <div className="period-tabs" aria-label="Selecionar periodo">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            className={period === p.value ? 'active' : ''}
            onClick={() => onPeriodChange(p.value)}
            aria-pressed={period === p.value}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="topbar-search" role="search">
        <Icon name="search" size={13} aria-hidden />
        <input
          placeholder="buscar decisoes, features, bloqueios..."
          aria-label="Busca rapida"
          onKeyDown={handleSearchKeyDown}
        />
        <span className="kbd" aria-label="Atalho barra">/</span>
      </div>
    </header>
  );
}
