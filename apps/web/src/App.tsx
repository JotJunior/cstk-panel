/**
 * App — shell principal: Sidebar 232px + Topbar + area de conteudo.
 * HashRouter configurado em main.tsx; rotas aqui via React Router v6 Routes.
 *
 * Layout pixel-perfect do prototipo:
 *  grid: 232px sidebar | 1fr main
 *  main: topbar sticky 52px + conteudo scrollavel
 *
 * Ref: spec.md FR-021, FR-022; tasks.md §5.1, §5.2
 */
import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar.js';
import { Topbar } from '@/components/Topbar.js';
import { DegradedBanner } from '@/states/index.js';
import { Overview } from '@/screens/Overview.js';
import { Placeholder } from '@/screens/Placeholder.js';
import type { PeriodParam, Meta } from '@cstk-panel/shared-types';

// Periodo global — compartilhado entre telas (elevado ao App)
type Period = PeriodParam;

export default function App() {
  const [period, setPeriod] = useState<Period>('7d');

  // Meta global — populado pela tela Overview via health endpoint
  // Serves as DegradedBanner state; upgraded per-query in screens
  const [globalMeta, _setGlobalMeta] = useState<Meta | null>(null);

  return (
    <div className="app">
      {/* Sidebar 232px fixo */}
      <Sidebar />

      {/* Area principal */}
      <div className="main">
        {/* Banner de degradacao — transversal, aparece em todas as telas */}
        {globalMeta?.degraded && <DegradedBanner meta={globalMeta} />}

        {/* Topbar sticky 52px */}
        <Topbar period={period} onPeriodChange={setPeriod} />

        {/* Conteudo das rotas */}
        <main className="content">
          <Routes>
            {/* Rota raiz — Visao Geral */}
            <Route path="/" element={<Overview period={period} />} />

            {/* Projetos */}
            <Route path="/projects" element={<Placeholder title="Projetos" description="Lista de projetos com rollup de execucoes." />} />
            <Route path="/projects/:project" element={<Placeholder title="Detalhe do Projeto" description="Rollup de features, execucoes e custo." />} />

            {/* Features */}
            <Route path="/features" element={<Placeholder title="Features" description="Todas as features cross-project." />} />
            <Route path="/features/:project/:feature" element={<Placeholder title="Detalhe da Feature" description="Execucoes, retros e metricas da feature." />} />

            {/* Execucoes */}
            <Route path="/executions" element={<Placeholder title="Execucoes" description="Todas as execucoes do orquestrador." />} />
            <Route path="/executions/:execucaoId" element={<Placeholder title="Detalhe da Execucao" description="Ondas, decisoes, tarefas, eventos, alertas, bloqueios, skills." />} />

            {/* Alertas */}
            <Route path="/alerts" element={<Placeholder title="Alertas" description="Movimentos circulares e breaches de orcamento." />} />

            {/* Metricas */}
            <Route path="/metrics" element={<Placeholder title="Metricas" description="Tendencias e distribuicoes cross-execucao." />} />

            {/* Busca */}
            <Route path="/search" element={<Placeholder title="Busca de Conhecimento" description="Full-text sobre decisoes, bloqueios, retros e skills." />} />

            {/* Fallback */}
            <Route path="*" element={<Placeholder title="Pagina nao encontrada" description="A rota solicitada nao existe." />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
