// ============================================================================
// Encuesta post-llamada del Sales Copilot — definición y etiquetas.
// ----------------------------------------------------------------------------
// Vive aquí (y no en el modal) porque la consumen también el servicio del
// copilot (reporte sin transcripción) y la página — y para poder testearla.
// ============================================================================
import type { CallSurveyAnswers } from '../types';

export const EMPTY_SURVEY: CallSurveyAnswers = {
  resultado: '',
  objecion: '',
  oferta: 'no',
  hora: 'no',
  desenlace: '',
};

/** Cada pregunta del formulario: key + opciones ('*' = obligatoria). */
export interface SurveyQuestion {
  key: keyof CallSurveyAnswers;
  label: string;
  required?: boolean;
  options: { id: string; label: string }[];
  /** Grid responsive (default: 2 columnas). */
  cols?: string;
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
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

/** Etiqueta legible de cualquier opción: SURVEY_LABELS[`${key}:${id}`] — usada
 *  en el comentario del prospecto y en el reporte sin transcripción. */
export const SURVEY_LABELS: Record<string, string> = {};
for (const q of SURVEY_QUESTIONS) {
  for (const o of q.options) {
    SURVEY_LABELS[`${q.key}:${o.id}`] = o.label;
  }
}

/** Lee la etiqueta de una respuesta ('' = id vacío, p.ej. "No hubo objeción"). */
export function surveyLabel(key: keyof CallSurveyAnswers, id: string): string {
  return SURVEY_LABELS[`${key}:${id}`] ?? id;
}
