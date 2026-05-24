import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient configurado para painel de observabilidade read-only.
 * - staleTime: 60s — dados de observabilidade mudam raramente; evita refetch excessivo
 * - gcTime: 5min — mantém cache quente entre navegações
 * - retry: 2 — backoff antes de mostrar erro
 * - refetchOnWindowFocus: false — painel read-only, sem mutacoes; refetch manual suficiente
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
