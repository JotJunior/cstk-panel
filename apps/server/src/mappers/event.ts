/**
 * Mapper: EventRow → EventDTO.
 * Task 3.4.5
 */
import type { EventDTO } from '@cstk-panel/shared-types';
import type { EventRow } from '../db/queries/events.js';

type ValidEventType = 'lock_contention' | 'validation_failed' | 'wave_retry' | 'schedule_wait';
const VALID_EVENT_TYPES = new Set<string>([
  'lock_contention', 'validation_failed', 'wave_retry', 'schedule_wait',
]);

function toEventType(raw: string): ValidEventType {
  if (VALID_EVENT_TYPES.has(raw)) return raw as ValidEventType;
  // Fallback para tipo nao reconhecido — preservar como schedule_wait (mais seguro)
  return 'schedule_wait';
}

export function mapEvent(row: EventRow): EventDTO {
  return {
    execucaoId: row.execucao_id,
    eventType: toEventType(row.event_type),
    timestamp: row.timestamp,
    descricao: row.descricao,
  };
}

export function mapEvents(rows: EventRow[]): EventDTO[] {
  return rows.map(mapEvent);
}
