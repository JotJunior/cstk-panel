/**
 * Mapper: AlertRow → AlertSignalDTO.
 * Task 3.4.5
 */
import type { AlertSignalDTO } from '@cstk-panel/shared-types';
import type { AlertRow } from '../db/queries/alerts.js';

type ValidTipo = 'circular' | 'budget_breach';
const VALID_TIPOS = new Set<string>(['circular', 'budget_breach']);

function toTipo(raw: string): ValidTipo {
  if (VALID_TIPOS.has(raw)) return raw as ValidTipo;
  return 'budget_breach';
}

export function mapAlert(row: AlertRow): AlertSignalDTO {
  return {
    execucaoId: row.execucao_id,
    tipo: toTipo(row.tipo),
    subtipo: row.subtipo,
    valorConsumido: row.valor_consumido,
    valorThreshold: row.valor_threshold,
    descricao: row.descricao,
    wave: row.wave,
  };
}

export function mapAlerts(rows: AlertRow[]): AlertSignalDTO[] {
  return rows.map(mapAlert);
}
