import { useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CallSurveyAnswers } from '../../types';
import { EMPTY_SURVEY, SURVEY_QUESTIONS as QUESTIONS } from '../../data/callSurvey';

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