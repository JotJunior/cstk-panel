/**
 * Sidebar — 232px fixo, dark-mode-first, pixel-perfect do prototipo.
 * Ref: spec.md FR-021; plan.md §Project Structure `apps/web`
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon.js';

interface NavRoute {
  id: string;
  label: string;
  icon: string;
  path: string;
  matchPrefix?: string[];
}

const ROUTES: NavRoute[] = [
  { id: 'overview', label: 'Visão Geral', icon: 'home', path: '/' },
  { id: 'projects', label: 'Projetos', icon: 'folder', path: '/projects' },
  { id: 'features', label: 'Features', icon: 'git-branch', path: '/features' },
  { id: 'executions', label: 'Execuções', icon: 'activity', path: '/executions' },
  { id: 'alerts', label: 'Alertas', icon: 'alert', path: '/alerts' },
  { id: 'metrics', label: 'Métricas', icon: 'bar', path: '/metrics' },
  { id: 'tasks', label: 'Tarefas', icon: 'check', path: '/tasks' },
  { id: 'incidents', label: 'Incidentes', icon: 'zap', path: '/incidents' },
  { id: 'search', label: 'Busca de Conhecimento', icon: 'search', path: '/search' },
];

function isRouteActive(route: NavRoute, pathname: string): boolean {
  if (route.path === '/') return pathname === '/';
  return pathname.startsWith(route.path);
}

interface SidebarProps {
  alertCount?: number;
  freshness?: { label: string; degraded: boolean };
}

type Theme = 'dark' | 'light';

export function Sidebar({ alertCount = 0, freshness }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Tema (decorativo — dark-mode-first; persiste a preferencia em data-theme).
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('cstk-theme') as Theme | null) ?? 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cstk-theme', theme);
  }, [theme]);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <img className="brand-logo" src="/cstk-logo.png" alt="cstk-panel" width={28} height={28} />
        <div>
          <div className="brand-name">cstk-panel</div>
          <div className="brand-tag">observabilidade · v3.19</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="nav-section" aria-label="Navegacao principal">
        <div className="nav-label">observar</div>
        {ROUTES.slice(0, 4).map((route) => (
          <NavItem
            key={route.id}
            route={route}
            active={isRouteActive(route, location.pathname)}
            onClick={() => navigate(route.path)}
          />
        ))}

        <div className="nav-label" style={{ marginTop: 12 }}>diagnosticar</div>
        {ROUTES.slice(4).map((route) => (
          <NavItem
            key={route.id}
            route={route}
            active={isRouteActive(route, location.pathname)}
            onClick={() => navigate(route.path)}
            badge={route.id === 'alerts' && alertCount > 0 ? alertCount : undefined}
          />
        ))}
      </nav>

      {/* Footer: freshness + fonte de dados + tema */}
      <div className="sidebar-foot">
        <div className={`freshness-widget${freshness?.degraded ? ' degraded' : ''}`}>
          <span className="fresh-dot" />
          <div className="col" style={{ gap: 0, lineHeight: 1.3, flex: 1 }}>
            <span style={{ color: 'var(--text-1)', fontSize: 11.5 }}>
              Indice atualizado{' '}
              <span className="mono">{freshness?.label ?? '...'}</span>
            </span>
            <span className="mono" style={{ color: 'var(--text-3)', fontSize: 10 }}>
              knowledge.db · schema v2
            </span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <span
            className="row gap-2"
            role="link"
            tabIndex={0}
            onClick={() => navigate('/source')}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/source')}
            style={{ cursor: 'pointer', color: 'var(--text-2)', fontSize: 11 }}
          >
            <Icon name="database" size={12} aria-hidden />fonte de dados
          </span>
          <button
            className="ico-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="tema (decorativo)"
            aria-label="Alternar tema (decorativo)"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={12} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}

interface NavItemProps {
  route: NavRoute;
  active: boolean;
  onClick: () => void;
  badge?: number | undefined;
}

function NavItem({ route, active, onClick, badge }: NavItemProps) {
  return (
    <div
      className={`nav-item${active ? ' active' : ''}`}
      onClick={onClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={route.icon} size={15} className="ico" />
      <span>{route.label}</span>
      {badge != null && badge > 0 && (
        <span className="nav-badge" aria-label={`${badge} alertas criticos`}>
          {badge}
        </span>
      )}
    </div>
  );
}
