/**
 * App — shell principal: Sidebar 232px + Topbar + area de conteudo.
 * HashRouter configurado em main.tsx; rotas aqui via React Router v6 Routes.
 *
 * Layout pixel-perfect do prototipo:
 *  grid: 232px sidebar | 1fr main
 *  main: topbar sticky 52px + conteudo scrollavel
 *
 * Ref: spec.md FR-021, FR-022; tasks.md §5.1, §5.2, §6
 */
import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar.js';
import { Topbar } from '@/components/Topbar.js';
import { Overview } from '@/screens/Overview.js';
import { ExecutionDetail } from '@/screens/ExecutionDetail.js';
import { Executions } from '@/screens/Executions.js';
import { Search } from '@/screens/Search.js';
import { Alerts } from '@/screens/Alerts.js';
import { Metrics } from '@/screens/Metrics.js';
import { Projects } from '@/screens/Projects.js';
import { ProjectDetail } from '@/screens/ProjectDetail.js';
import { Features } from '@/screens/Features.js';
import { FeatureDetail } from '@/screens/FeatureDetail.js';
import { Placeholder } from '@/screens/Placeholder.js';
import type { PeriodParam } from '@cstk-panel/shared-types';

// Periodo global — compartilhado entre telas (elevado ao App)
type Period = PeriodParam;

export default function App() {
  const [period, setPeriod] = useState<Period>('7d');

  return (
    <div className="app">
      {/* Sidebar 232px fixo */}
      <Sidebar />

      {/* Area principal */}
      <div className="main">
        {/* Topbar sticky 52px */}
        <Topbar period={period} onPeriodChange={setPeriod} />

        {/* Conteudo das rotas */}
        <main className="content">
          <Routes>
            {/* Rota raiz — Visao Geral (US1) */}
            <Route path="/" element={<Overview period={period} />} />

            {/* Projetos */}
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:project" element={<ProjectDetail />} />

            {/* Features */}
            <Route path="/features" element={<Features />} />
            <Route path="/features/:project/:feature" element={<FeatureDetail />} />

            {/* Execucoes (US2) */}
            <Route path="/executions" element={<Executions />} />
            <Route path="/executions/:execucaoId" element={<ExecutionDetail />} />

            {/* Alertas (US4) */}
            <Route path="/alerts" element={<Alerts period={period} />} />

            {/* Metricas (US5) */}
            <Route path="/metrics" element={<Metrics period={period} />} />

            {/* Busca FTS5 (US3) */}
            <Route path="/search" element={<Search />} />

            {/* Fallback */}
            <Route path="*" element={<Placeholder title="Pagina nao encontrada" description="A rota solicitada nao existe." />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
