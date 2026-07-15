/**
 * Bootstrap do servidor Fastify 5.
 * Ref: plan.md §Project Structure; spec.md FR-017 (localhost bind), FR-019 (headers)
 *
 * Principios constitucionais aplicados aqui:
 * - Principio I: read-only absoluto (aberto em open.ts)
 * - Principio II: degradacao nunca quebra (servidor sobe mesmo sem DB)
 * - Principio VI: snapshot freshness em cada resposta
 */
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { loadConfig } from './config.js';
import { healthRoutes } from './routes/health.js';
import { overviewRoutes } from './routes/overview.js';
import { projectRoutes } from './routes/projects.js';
import { featureRoutes } from './routes/features.js';
import { docsRoutes } from './routes/docs.js';
import { executionRoutes } from './routes/executions.js';
import { alertRoutes } from './routes/alerts.js';
import { taskRoutes } from './routes/tasks.js';
import { eventRoutes } from './routes/events.js';
import { metricsRoutes } from './routes/metrics.js';
import { searchRoutes } from './routes/search.js';
import { memoryRoutes } from './routes/memories.js';
import { startIngestWatcher, DEFAULT_WATCH_INTERVAL_MS } from './watchers/ingest-watcher.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const server = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  // CORS restrito a origem do front-end (FR-017). Irrelevante quando a UI e
  // servida pelo proprio server (mesma origem), mas mantido para o modo dev
  // (Vite em :5173 chamando a API em :3001).
  await server.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'OPTIONS'],
  });

  // Headers de seguranca obrigatorios em TODA resposta — inclusive os assets
  // estaticos do SPA (FR-019). NAO fixa Content-Type aqui: isso corromperia o
  // HTML/CSS/JS servido pelo @fastify/static. O Content-Type das respostas de
  // API e definido no escopo /api/v1 abaixo (e o Fastify ja serializa objetos
  // como application/json por padrao).
  server.addHook('onSend', async (_request, reply, _payload) => {
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('Cache-Control', 'no-store');
  });

  // Serving estatico do SPA buildado (apps/web/dist) — faz `npm run start` subir
  // API + front-end no mesmo processo e porta. Degrada com elegancia (Principio
  // II): se o build do web nao existe, sobe so a API e loga aviso.
  const webEnabled = existsSync(config.webDir);
  if (webEnabled) {
    await server.register(fastifyStatic, {
      root: config.webDir,
      prefix: '/',
      // index.html servido em '/'; assets servidos por path; ausentes caem no
      // notFoundHandler (fallback SPA abaixo).
      wildcard: true,
    });
  }

  // Registrar todas as rotas sob /api/v1
  await server.register(async (v1) => {
    // Content-Type JSON explicito apenas no escopo da API (FR-019).
    v1.addHook('onSend', async (_request, reply, _payload) => {
      void reply.header('Content-Type', 'application/json; charset=utf-8');
    });
    await v1.register(healthRoutes);
    await v1.register(overviewRoutes);
    await v1.register(projectRoutes);
    await v1.register(featureRoutes);
    await v1.register(docsRoutes);
    await v1.register(executionRoutes);
    await v1.register(alertRoutes);
    await v1.register(taskRoutes);
    await v1.register(eventRoutes);
    await v1.register(metricsRoutes);
    await v1.register(searchRoutes);
    await v1.register(memoryRoutes);
  }, { prefix: '/api/v1' });

  // Watcher de ingestao em segundo plano (US1, FR-001/FR-004/FR-013). Iniciado
  // apos o registro das rotas — timer independente, nao depende de nenhuma
  // rota estar servindo. Cadencia configuravel via CSTK_WATCH_INTERVAL_MS
  // (default DEFAULT_WATCH_INTERVAL_MS, ajustado empiricamente — task 2.3.4).
  const watchIntervalRaw = process.env['CSTK_WATCH_INTERVAL_MS'];
  const watchIntervalMs = watchIntervalRaw && /^\d+$/.test(watchIntervalRaw)
    ? parseInt(watchIntervalRaw, 10)
    : DEFAULT_WATCH_INTERVAL_MS;
  const watcherHandle = startIngestWatcher({
    dbPath: config.dbPath,
    supportedSchemaVersions: config.supportedSchemaVersions,
    intervalMs: watchIntervalMs,
    onTickError: (err: unknown) => {
      // Falha de tick nunca derruba o processo (Principio II) — apenas logada.
      server.log.warn({ err }, 'ingest-watcher: tick falhou');
    },
  });
  // Encerramento limpo do timer no shutdown do processo (task 2.5.2) — evita
  // handle pendente / processo que nao finaliza.
  server.addHook('onClose', (_instance, done) => {
    watcherHandle.stop();
    done();
  });

  // 404 handler. Rotas /api/* (e tudo quando o web nao esta habilitado) retornam
  // o envelope JSON estruturado (nunca HTML). Demais paths, com o SPA habilitado,
  // caem no fallback de history: devolve index.html para o React Router resolver
  // a rota no cliente.
  server.setNotFoundHandler((request, reply) => {
    if (webEnabled && !request.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({
      data: null,
      meta: {
        degraded: false,
        reason: null,
        freshness: { mtime: '', maxIngestedAt: '' },
        schemaVersion: '2',
      },
      error: 'Not found',
    });
  });

  // Iniciar servidor — FR-017: bind APENAS em 127.0.0.1
  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(
      `Server listening on ${config.host}:${config.port}`
    );
    server.log.info(`DB path: ${config.dbPath}`);
    if (webEnabled) {
      server.log.info(`Web UI served from ${config.webDir}`);
    } else {
      server.log.warn(
        `Web UI desabilitada: build ausente em ${config.webDir} (rode "npm run build"). Apenas a API esta no ar.`
      );
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
