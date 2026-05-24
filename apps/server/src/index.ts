/**
 * Bootstrap do servidor Fastify 5.
 * Ref: plan.md §Project Structure; spec.md FR-017 (localhost bind), FR-019 (headers)
 *
 * Principios constitucionais aplicados aqui:
 * - Principio I: read-only absoluto (aberto em open.ts)
 * - Principio II: degradacao nunca quebra (servidor sobe mesmo sem DB)
 * - Principio VI: snapshot freshness em cada resposta
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig } from './config.js';
import { healthRoutes } from './routes/health.js';
import { overviewRoutes } from './routes/overview.js';
import { projectRoutes } from './routes/projects.js';
import { featureRoutes } from './routes/features.js';
import { executionRoutes } from './routes/executions.js';
import { alertRoutes } from './routes/alerts.js';
import { taskRoutes } from './routes/tasks.js';
import { eventRoutes } from './routes/events.js';
import { metricsRoutes } from './routes/metrics.js';
import { searchRoutes } from './routes/search.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const server = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  // CORS restrito a origem do front-end (FR-017)
  await server.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'OPTIONS'],
  });

  // Hook global: headers de seguranca obrigatorios em TODA resposta (FR-019)
  server.addHook('onSend', async (_request, reply, _payload) => {
    void reply.header('Content-Type', 'application/json; charset=utf-8');
    void reply.header('X-Content-Type-Options', 'nosniff');
    void reply.header('X-Frame-Options', 'DENY');
    void reply.header('Cache-Control', 'no-store');
  });

  // Registrar todas as rotas sob /api/v1
  await server.register(async (v1) => {
    await v1.register(healthRoutes);
    await v1.register(overviewRoutes);
    await v1.register(projectRoutes);
    await v1.register(featureRoutes);
    await v1.register(executionRoutes);
    await v1.register(alertRoutes);
    await v1.register(taskRoutes);
    await v1.register(eventRoutes);
    await v1.register(metricsRoutes);
    await v1.register(searchRoutes);
  }, { prefix: '/api/v1' });

  // 404 handler — resposta JSON estruturada (nunca HTML)
  server.setNotFoundHandler((_request, reply) => {
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
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
