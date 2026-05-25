/**
 * Topbar — altura 52px, sticky, breadcrumb + periodo + filtro de projeto + busca.
 * Ref: spec.md FR-021, FR-022; prototipo app.jsx Topbar (CARD-SHELL-08).
 *
 * Filtro de projeto: populado pela API real (/projects); valor derivado da rota
 * (/projects/:project); selecionar navega ao detalhe do projeto, "Todos" → /projects.
 * Escopar TODAS as telas por projeto e um filtro global e trabalho separado
 * (ver tasks-cards.md, planejamento dos demais cards).
 */
import { useNavigate, useMatch } from 'react-router-dom';
import { Icon } from './Icon.js';
import { Breadcrumb } from './Breadcrumb.js';
import { useProjects } from '@/lib/hooks.js';
import type { PeriodParam, ProjectRollup } from '@cstk-panel/shared-types';

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

  // Projeto corrente derivado da rota /projects/:project
  const projectMatch = useMatch('/projects/:project');
  const currentProject = projectMatch?.params.project
    ? decodeURIComponent(projectMatch.params.project)
    : '';

  // Lista de projetos para o filtro (cacheada via TanStack Query)
  const projectsQ = useProjects();
  const projects = (projectsQ.data?.data ?? []) as ProjectRollup[];

  // Garante que o projeto da rota apareca como opcao mesmo se a lista ainda
  // nao carregou (evita value sem <option> correspondente no select controlado).
  const projectIds = projects.map((p) => p.project);
  const options = currentProject && !projectIds.includes(currentProject)
    ? [currentProject, ...projectIds]
    : projectIds;

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    navigate(value ? `/projects/${encodeURIComponent(value)}` : '/projects');
  }

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

      <select
        className="select"
        aria-label="Filtrar por projeto"
        value={currentProject}
        onChange={handleProjectChange}
      >
        <option value="">Todos os projetos</option>
        {options.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>

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
