import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Suite completa: shared-types (unitarios/paridade) + server (integracao)
    include: [
      'packages/**/*.test.ts',
      'packages/**/*.spec.ts',
      'apps/server/test/**/*.test.ts',
      'apps/server/src/**/*.test.ts',
    ],
    // Timeout maior para testes de integracao com DB real
    testTimeout: 15000,
    coverage: {
      reporter: ['text', 'json'],
    },
  },
});
