/** Etapas do pipeline SDD na ordem canonica (9 etapas). */
export const SDD_STAGES = [
  'briefing', 'constitution', 'specify', 'clarify', 'plan',
  'checklist', 'create-tasks', 'execute-task', 'review-task',
] as const;

export type SddStage = (typeof SDD_STAGES)[number];
