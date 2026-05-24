/**
 * Breadcrumb — derivado da URL corrente, hierarquia navegavel.
 * Ref: spec.md FR-022; plan.md §drill-down <= 4 cliques
 */
import { useLocation, useNavigate } from 'react-router-dom';

interface Crumb {
  label: string;
  path?: string;
  mono?: boolean;
  current?: boolean;
}

function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'cstk-panel', path: '/' }];
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    crumbs.push({ label: 'Visao Geral', current: true });
    return crumbs;
  }

  const LABELS: Record<string, string> = {
    projects: 'Projetos',
    features: 'Features',
    executions: 'Execucoes',
    alerts: 'Alertas',
    metrics: 'Metricas',
    search: 'Busca de Conhecimento',
  };

  // Build crumbs from path segments
  let accumulated = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    accumulated += '/' + seg;
    const label = LABELS[seg] ?? seg;
    const isLast = i === segments.length - 1;
    const isMono = !(seg in LABELS); // ID segments are mono

    const crumb: Crumb = {
      label,
      mono: isMono,
      current: isLast,
    };
    if (!isLast) crumb.path = accumulated;
    crumbs.push(crumb);
  }

  return crumbs;
}

export function Breadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = buildCrumbs(location.pathname);

  return (
    <nav className="crumbs" aria-label="Caminho de navegacao">
      {crumbs.map((crumb, i) => (
        <span key={i} className="row" style={{ alignItems: 'center', gap: 8 }}>
          {i > 0 && <span className="sep" aria-hidden>/</span>}
          <span
            className={`crumb${crumb.mono ? ' mono-text' : ''}${crumb.current ? ' current' : ''}${crumb.path ? ' clickable' : ''}`}
            onClick={crumb.path ? () => navigate(crumb.path!) : undefined}
            title={crumb.label}
          >
            {crumb.label}
          </span>
        </span>
      ))}
    </nav>
  );
}
