/**
 * PipelineProgress — barra de progresso das 9 etapas SDD.
 * Portado do prototipo: modo compacto (.pipeline) e rotulado (.pipeline-labeled).
 * Ref: docs/06-ui-ux-design/castk-panel/project/components.jsx
 */
import { SDD_STAGES } from '@/lib/constants.js';

type Status = 'em_andamento' | 'aguardando_humano' | 'concluida' | 'abortada' | null;

interface PipelineProgressProps {
  etapa: string | null;
  status: Status;
  labeled?: boolean;
}

export function PipelineProgress({ etapa, status, labeled = false }: PipelineProgressProps) {
  const idx = etapa ? (SDD_STAGES as readonly string[]).indexOf(etapa) : -1;

  if (labeled) {
    return (
      <div className="pipeline-labeled">
        {SDD_STAGES.map((st, i) => {
          const done = (i < idx) || (i === idx && status === 'concluida');
          const current = i === idx && status !== 'concluida' && status !== 'abortada';
          return (
            <div key={st} className={`stage${done ? ' done' : ''}${current ? ' current' : ''}`}>
              <div className="bar" />
              <div className="label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pipeline">
      {SDD_STAGES.map((st, i) => {
        let cls = '';
        if (status === 'abortada' && i >= idx) cls = 'aborted';
        else if (status === 'concluida') cls = 'done';
        else if (i < idx) cls = 'done';
        else if (i === idx) cls = 'current';
        return <div key={st} className={`step ${cls}`} title={st} />;
      })}
    </div>
  );
}
