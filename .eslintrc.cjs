// ESLint config raiz — proibe dangerouslySetInnerHTML e verbos SQL de mutacao
// Ref: spec.md FR-001 (read-only), plan.md §Constitution Check (Principio V)
'use strict';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Principio V — conteudo de agente e UNTRUSTED; nunca setar innerHTML
    'no-restricted-properties': [
      'error',
      {
        object: 'element',
        property: 'innerHTML',
        message: 'Principio V: usar textContent. dangerouslySetInnerHTML/innerHTML proibido (XSS risk + UNTRUSTED content).',
      },
    ],
    // Proibir dangerouslySetInnerHTML em JSX
    'no-restricted-syntax': [
      'error',
      {
        selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
        message: 'Principio V: dangerouslySetInnerHTML proibido. Conteudo de agente e UNTRUSTED — renderizar via textContent/JSX text node.',
      },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      // Regras adicionais para apps/server — proibir verbos SQL de mutacao
      files: ['apps/server/src/**/*.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
            message: 'Principio V: dangerouslySetInnerHTML proibido.',
          },
          // Nota: verbos SQL sao checados pelo script lint:readonly-check (grep)
          // pois strings SQL nao sao parseadas pelo AST do ESLint de forma confiavel.
        ],
      },
    },
    {
      files: ['*.cjs', '*.js'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.d.ts', 'coverage/'],
};
