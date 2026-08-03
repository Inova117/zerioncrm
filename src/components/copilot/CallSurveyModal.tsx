import { useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CallSurveyAnswers } from '../../types';

export const EMPTY_SURVEY: CallSurveyAnswers = {
  resultado: '',
  objecion: '',
  oferta: 'no',
  hora: 'no',
  desenlace: '',
};

/** Cada pregunta del formulario: key + opciones ('*' = obligatoria). */
interface Question {
  key: keyof CallSurveyAnswers;
  label: string;
  required?: boolean;
  options: { id: string; label: string }[];
  /** Grid responsive (default: 2 columnas). */
  cols?: string;
}

const QUESTIONS: Question[] = [
  {
    key: 'resultado',
    label: '1 · ¿Qué pasó con la llamada?',
    required: true,
    cols: 'grid-cols-1 sm:grid-cols-2',
    options: [
      { id: 'contacto', label: 'Hablé con el dueño' },
      { id: 'gatekeeper', label: 'Solo gatekeeper' },
      { id: 'no-contesto', label: 'No contestó' },
      { id: 'colgo', label: 'Colgó rápido / cortó' },
    ],
  },
  {
    key: 'objecion',
    label: '2 · ¿Cuál fue la objeción principal?',
    cols: 'grid-cols-1 sm:grid-cols-2',
    options: [
      { id: '', label: 'No hubo objeción' },
      { id: 'caro', label: 'Está caro / no hay presupuesto' },
      { id: 'no-interesa', label: 'No me interesa' },
      { id: 'ya-pagina', label: 'Ya tengo página web' },
      { id: 'sobrino', label: 'Mi sobrino / amigo la hace gratis' },
      { id: 'mandame-info', label: 'Mándame la info' },
      { id: 'no-tiempo', label: 'No tengo tiempo' },
      { id: 'pensarlo', label: 'Déjame pensarlo' },
      { id: 'otro', label: 'Otra objeción' },
    ],
  },
  {
    key: 'oferta',
    label: '3 · ¿Llegaste a presentar la oferta?',
    cols: 'grid-cols-2',
    options: [
      { id: 'si', label: 'Sí' },
      { id: 'no', label: 'No' },
    ],
  },
  {
    key: 'hora',
    label: '4 · ¿Aceptó ver la página (Toque 1)?',
    cols: 'grid-cols-1 sm:grid-cols-3',
    options: [
      { id: 'amarrada', label: 'Sí, con hora amarrada' },
      { id: 'sin-hora', label: 'Sí, pero sin hora' },
      { id: 'no', label: 'No' },
    ],
  },
  {
    key: 'desenlace',
    label: '5 · ¿Cómo terminó?',
    required: true,
    cols: 'grid-cols-1 sm:grid-cols-2',
    options: [
      { id: 'cliente', label: 'Cerré — pago confirmado' },
      { id: 'reunion', label: 'Agendó reunión / cita' },
      { id: 'caliente', label: 'Aceptó ver la página con hora' },
      { id: 'tibio', label: 'Quedó tibio — seguimiento' },
      { id: 'no-acepto', label: 'Vio la página y NO la quiere (reactivación 90 días)' },
      { id: 'perdido', label: 'Perdido — rechazo definitivo' },
    ],
  },
];

interface CallSurveyModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (answers: CallSurveyAnswers) => void;
}

export function CallSurveyModal({ open, onClose, onSave }: CallSurveyModalProps) {
  const [answers, setAnswers] = useState<CallSurveyAnswers>(EMPTY_SURVEY);
  const [resetKey, setResetKey] = useState(0);

  const valid = answers.resultado !== '' && answers.desenlace !== '';

  const save = () => {
    if (!valid) return;
    onSave(answers);
    setAnswers(EMPTY_SURVEY);
    setResetKey((k) => k + 1); // reinicia para la próxima llamada
  };

  if (!open) return null;

  return (
    <div key={resetKey} className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/50 p-4 backdrop-blur-sm">
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-600" />
            <div>
              <h2 className="text-base font-semibold text-surface-900">¿Qué pasó en la llamada?</h2>
              <p className="text-xs text-surface-400">2 min — esta información alimenta tus métricas reales.</p>
            </div>
          </div>
          <button className="btn-ghost rounded-lg p-1.5 text-surface-400" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <p className="mb-2 text-sm font-semibold text-surface-800">
                {q.label} {q.required && <span className="text-brand-500">*</span>}
              </p>
              <div className={cn('grid gap-1.5', q.cols)}>
                {q.options.map((o) => (
                  <button
                    key={`${q.key}-${o.id}`}
                    onClick={() => setAnswers((a) => ({ ...a, [q.key]: o.id }))}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      answers[q.key] === o.id
                        ? 'border-brand-500 bg-brand-50 text-brand-800'
                        : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-surface-100 px-5 py-3">
          <button className={cn('btn-primary w-full py-3', !valid && 'opacity-50')} onClick={save} disabled={!valid}>
            Guardar y seguir
          </button>
          <p className="mt-1.5 text-center text-[11px] text-surface-400">
            Se suma a las métricas de llamadas (embudo, objeciones, cierres).
          </p>
        </div>
      </div>
    </div>
  );
}