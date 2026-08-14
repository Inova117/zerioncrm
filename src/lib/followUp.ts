// ============================================================================
// followUp — el sistema de seguimiento demo-first (pipeline v2).
//
// Principio: cada etapa del pipeline es una PRÓXIMA ACCIÓN con FECHA, no una
// temperatura. `nextActionAt` + `touch` en el lead alimentan la vista HOY,
// que le dice al vendedor EXACTAMENTE a quién escribir y qué enviar — sin que
// decida ni recuerde nada.
//
// Secuencias por etapa:
//   demo-enviada : 6 toques (día 1 → día 14); al completar el 6° → reactivacion
//   en-contacto  : hasta 3 intentos de llamada (+2 días entre cada uno)
//   negociando   : seguimiento abierto (+2 días, sin tope)
//   reactivacion : hasta 3 reheats (+30 días = 30/60/90)
//   nuevo/cliente/perdido: fuera de la cola (nextActionAt = null)
//
// Las plantillas de mensaje usan las variables de fillLeadVars (scriptUtils):
// [SALUDO] [NOMBRE] [EMPRESA] [rubro] [CIUDAD] [PRECIO] [RESEÑAS] [RATING].
// ============================================================================
import type { Lead, Temperature } from '../types';
import { normalizeTemperature } from './constants';
import { parseISO } from 'date-fns';

export const TOUCH_MAX_DEMO = 6; // d1 → d14
export const ATTEMPT_MAX = 3; // llamadas sin contacto
export const REHEAT_MAX = 3; // 30/60/90 días
export const REHEAT_DAYS = 30;
export const RETRY_DAYS = 2; // en-contacto y negociando
export const DEFAULT_HOUR = 10; // los toques caen a las 10:00 local

export interface TouchInfo {
  stage: Temperature;
  /** Número del PRÓXIMO toque (1-based). */
  touch: number;
  total: number;
  /** P.ej. "Día 4 · Agitación". */
  label: string;
  /** La orden concreta para el vendedor. */
  action: string;
  /** Plantilla del mensaje (variables [NOMBRE]…; '' = no hay texto fijo). */
  message: string;
  channel: 'whatsapp' | 'llamada';
}

// ---- Secuencia de la demo (d1→d14) -----------------------------------------
// delayAfter[t] = días que pasan entre completar el toque t y el siguiente.
const DEMO_DELAYS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4 };

const DEMO_TOUCHES: Omit<TouchInfo, 'stage' | 'touch' | 'total'>[] = [
  {
    label: 'Día 1 · WhatsApp',
    action: 'Escribir: "¿ya la vio? ¿qué fue lo que más le gustó?"',
    message:
      'Hola [SALUDO] 👋 ¿Ya vio su página? ¿Qué fue lo que más le gustó?',
    channel: 'whatsapp',
  },
  {
    label: 'Día 2 · Llamada',
    action: 'Llamar (no escribir). "Le llamo porque por WhatsApp se pierde todo… 2 minutos."',
    message: 'Le llamo porque por WhatsApp se pierde todo… solo 2 minutos.',
    channel: 'llamada',
  },
  {
    label: 'Día 4 · Agitación',
    action: 'WhatsApp con el dato de un competidor que SÍ aparece en Google',
    message:
      '[NOMBRE], vi algo hoy: hay negocios como el suyo en [CIUDAD] que aparecen en Google y usted no. Los clientes que lo buscan los encuentran a ellos. Su página ya está lista para que eso pare — solo falta que me diga "dale". ¿La activamos esta semana?',
    channel: 'whatsapp',
  },
  {
    label: 'Día 7 · Escasez',
    action: 'WhatsApp: precio de lanzamiento + agenda de entregas',
    message:
      '[NOMBRE], le soy honesto: [PRECIO] es precio de lanzamiento — estoy relanzando el servicio y no se va a quedar ahí. Además esta semana ya tengo entregas agendadas. Si me confirma antes del viernes, mantengo su precio y su lugar. ¿Le parece?',
    channel: 'whatsapp',
  },
  {
    label: 'Día 10 · Breakup',
    action: 'WhatsApp: "¿es el precio o el valor?"',
    message:
      '[NOMBRE], no quiero ser de los que insisten. Solo una pregunta y no le molesto más: ¿es el precio, o que no le ve el valor? Si es el precio, lo hablamos. Si es el valor, dígame qué le falta y lo arreglo.',
    channel: 'whatsapp',
  },
  {
    label: 'Día 14 · Cierre',
    action: 'WhatsApp: aviso de archivar. Si no compra → mover a Reactivación',
    message:
      'Voy a archivar su página el lunes para liberar espacio. Queda guardada un mes — si algún día la quiere, está lista. Gracias por la oportunidad, [NOMBRE]. 🙏',
    channel: 'whatsapp',
  },
];

// ---- Reheats de reactivación (30/60/90) --------------------------------------
const REHEAT_TOUCHES: Omit<TouchInfo, 'stage' | 'touch' | 'total'>[] = [
  {
    label: 'Reactivación +30 días',
    action: 'WhatsApp: sus reseñas nuevas + "le guardé su página"',
    message:
      '[NOMBRE], pasé por su ficha en Google — ¡ya va por [RESEÑAS]! 🎉 Le guardé su página. ¿La reactivamos con estos datos nuevos?',
    channel: 'whatsapp',
  },
  {
    label: 'Reactivación +60 días',
    action: 'WhatsApp: "¿cómo va la página que le estaban haciendo?"',
    message:
      '[NOMBRE], ¿cómo va la página que le estaban haciendo? Si se quedó en veremos, la suya sigue guardada.',
    channel: 'whatsapp',
  },
  {
    label: 'Reactivación +90 días',
    action: 'WhatsApp: caso de éxito del rubro',
    message:
      '[NOMBRE], entregué varias páginas nuevas esta semana. ¿Le muestro la de un negocio como el suyo?',
    channel: 'whatsapp',
  },
];

// ---- Toques genéricos --------------------------------------------------------
const CONTACT_TOUCH: Omit<TouchInfo, 'stage' | 'touch' | 'total'> = {
  label: 'Reintento de contacto',
  action: 'Volver a llamar (guion en frío del Copilot). 3 intentos → Perdido.',
  message: '',
  channel: 'llamada',
};

const NEGOTIATING_TOUCH: Omit<TouchInfo, 'stage' | 'touch' | 'total'> = {
  label: 'Seguimiento de negociación',
  action: 'Retomar el hilo por WhatsApp o llamada.',
  message:
    '[NOMBRE], quedamos en que lo iba a pensar. ¿Cómo va? Si tiene dudas del precio, lo hablamos. La página sigue lista.',
  channel: 'whatsapp',
};

// ---- Helpers de fechas --------------------------------------------------------

/** Fecha local a `daysFromNow` días, a las `hour`:00 (ISO). Injectable para tests. */
export function localAt(daysFromNow: number, hour = DEFAULT_HOUR, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export type FollowUpBucket = 'overdue' | 'today' | 'upcoming';

/** En qué cubo cae el próximo toque (null = fuera de la cola). */
export function followUpBucket(
  nextActionAt: string | null | undefined,
  now: Date = new Date()
): FollowUpBucket | null {
  if (!nextActionAt) return null;
  const d = parseISO(nextActionAt);
  if (Number.isNaN(d.getTime())) return null;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 86_400_000;
  const t = d.getTime();
  if (t < startToday) return 'overdue';
  if (t < endToday) return 'today';
  return 'upcoming';
}

// ---- Lectura: qué toque toca ahora -------------------------------------------

/** Información del PRÓXIMO toque de un lead, o null si su etapa no tiene cola. */
export function touchInfo(lead: Lead): TouchInfo | null {
  const stage = lead.temperature;
  const touch = Math.max(0, Math.round(lead.touch ?? 0));

  if (stage === 'demo-enviada') {
    const i = Math.min(Math.max(touch, 1), TOUCH_MAX_DEMO) - 1;
    return { stage, touch: i + 1, total: TOUCH_MAX_DEMO, ...DEMO_TOUCHES[i] };
  }
  if (stage === 'reactivacion') {
    const i = Math.min(Math.max(touch, 1), REHEAT_MAX) - 1;
    return { stage, touch: i + 1, total: REHEAT_MAX, ...REHEAT_TOUCHES[i] };
  }
  if (stage === 'en-contacto') {
    const t = Math.min(Math.max(touch, 1), ATTEMPT_MAX);
    return { stage, touch: t, total: ATTEMPT_MAX, ...CONTACT_TOUCH };
  }
  if (stage === 'negociando') {
    return { stage, touch: Math.max(touch, 1), total: 0, ...NEGOTIATING_TOUCH };
  }
  return null;
}

// ---- Escritura: reglas automáticas --------------------------------------------

/** Patch automático al MOVER un lead de etapa (los campos que el sistema
 *  maneja solo). No cambia nada si la etapa no cambió. `now` es inyectable
 *  para tests. */
export function stageFollowUpPatch(
  current: Lead,
  next: Temperature,
  now: Date = new Date()
): Partial<Lead> {
  if (current.temperature === next) return {};
  switch (next) {
    case 'demo-enviada':
      // El link acaba de salir: mañana a las 10 arranca la secuencia.
      return { touch: 1, nextActionAt: localAt(1, DEFAULT_HOUR, now) };
    case 'en-contacto':
      return { touch: 1, nextActionAt: localAt(RETRY_DAYS, DEFAULT_HOUR, now) };
    case 'negociando':
      return { touch: 1, nextActionAt: localAt(RETRY_DAYS, DEFAULT_HOUR, now) };
    case 'reactivacion':
      return { touch: 1, nextActionAt: localAt(REHEAT_DAYS, DEFAULT_HOUR, now) };
    case 'cliente':
    case 'perdido':
    case 'nuevo':
      return { touch: 0, nextActionAt: null };
    default:
      return {};
  }
}

/** Avanza el toque tras completarlo. Si la secuencia termina, devuelve el
 *  cambio de etapa (solo la temperatura — stageFollowUpPatch pone fecha/touch
 *  de la nueva etapa). Mismo-stage → touch+1 + nueva fecha. */
export function advanceTouch(lead: Lead, now: Date = new Date()): Partial<Lead> {
  const stage = lead.temperature;
  const touch = Math.max(0, Math.round(lead.touch ?? 0));

  if (stage === 'demo-enviada') {
    if (touch >= TOUCH_MAX_DEMO) return { temperature: 'reactivacion' };
    const delay = DEMO_DELAYS[touch] ?? RETRY_DAYS;
    return { touch: touch + 1, nextActionAt: localAt(delay, DEFAULT_HOUR, now) };
  }
  if (stage === 'reactivacion') {
    if (touch >= REHEAT_MAX) return { touch: REHEAT_MAX, nextActionAt: null };
    return { touch: touch + 1, nextActionAt: localAt(REHEAT_DAYS, DEFAULT_HOUR, now) };
  }
  if (stage === 'en-contacto') {
    const next = Math.min(touch + 1, ATTEMPT_MAX);
    return { touch: next, nextActionAt: localAt(RETRY_DAYS, DEFAULT_HOUR, now) };
  }
  if (stage === 'negociando') {
    return { touch: touch + 1, nextActionAt: localAt(RETRY_DAYS, DEFAULT_HOUR, now) };
  }
  return {};
}

/** Normaliza un lead leído de cualquier fuente (filas viejas, localStorage):
 *  etapa legacy → v2 y campos nuevos con defaults. Idempotente. */
export function normalizeLead<T extends Partial<Lead>>(l: T): T {
  return {
    ...l,
    temperature: normalizeTemperature(l.temperature),
    nextActionAt: l.nextActionAt ?? null,
    touch: typeof l.touch === 'number' ? l.touch : 0,
  };
}

// ---- Formulario: conversores datetime-local -----------------------------------

/** ISO → valor de <input type="datetime-local"> (hora local del navegador). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO ('' → null). */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
