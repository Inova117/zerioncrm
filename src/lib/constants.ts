import type { Temperature, Source, Service, TaskCadence, Role } from '../types';

// ---------------------------------------------------------------------------
// Pipeline stages (Kanban columns) — ordered
// ---------------------------------------------------------------------------
export interface StageConfig {
  key: Temperature;
  label: string;
  description: string;
  /** Tailwind text/border/bg color token base (see tailwind.config.js). */
  color: string; // hex, for charts + dots
  dot: string; // tailwind bg class
  ring: string; // tailwind ring/border class
  soft: string; // tailwind soft bg class
  text: string; // tailwind text class
}

export const STAGES: StageConfig[] = [
  {
    key: 'nuevo',
    label: 'Nuevo',
    description: 'Sin contactar — en cola de llamadas',
    color: '#64748b',
    dot: 'bg-surface-400',
    ring: 'border-surface-300',
    soft: 'bg-surface-100',
    text: 'text-surface-600',
  },
  {
    key: 'en-contacto',
    label: 'En contacto',
    description: 'Hablado — persiguiendo respuesta (intentos 1-3)',
    color: '#3b82f6',
    dot: 'bg-en-contacto',
    ring: 'border-blue-300',
    soft: 'bg-blue-50',
    text: 'text-blue-600',
  },
  {
    key: 'demo-enviada',
    label: 'Demo enviada',
    description: 'Vio su página — secuencia de seguimiento d1→d14',
    color: '#f59e0b',
    dot: 'bg-demo-enviada',
    ring: 'border-amber-300',
    soft: 'bg-amber-50',
    text: 'text-amber-600',
  },
  {
    key: 'negociando',
    label: 'Negociando',
    description: 'Precio / objeciones — la reunión es una fecha, no una etapa',
    color: '#ef4444',
    dot: 'bg-negociando',
    ring: 'border-red-300',
    soft: 'bg-red-50',
    text: 'text-red-600',
  },
  {
    key: 'cliente',
    label: 'Cliente',
    description: 'Cerrado — ¡ganado!',
    color: '#10b981',
    dot: 'bg-cliente',
    ring: 'border-emerald-300',
    soft: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  {
    // Demo-first: la página se construyó, la vio, y no la compró. NO es un
    // "perdido" cualquiera — el activo existe y es la lista de reactivación
    // a 30/60/90 días ("todavía tengo guardada la muestra que le hicimos").
    key: 'reactivacion',
    label: 'Reactivación',
    description: 'Vio su página hecha y no la compró — reheat a 30/60/90 días',
    color: '#14b8a6',
    dot: 'bg-reactivacion',
    ring: 'border-teal-300',
    soft: 'bg-teal-50',
    text: 'text-teal-600',
  },
  {
    key: 'perdido',
    label: 'Perdido',
    description: 'No avanzó',
    color: '#94a3b8',
    dot: 'bg-perdido',
    ring: 'border-surface-300',
    soft: 'bg-surface-100',
    text: 'text-surface-500',
  },
];

/** Columns shown on the Kanban board (includes Perdido so lost leads stay
 *  visible, countable and recoverable by dragging them back). */
export const BOARD_STAGES: Temperature[] = [
  'nuevo',
  'en-contacto',
  'demo-enviada',
  'negociando',
  'cliente',
  'reactivacion',
  'perdido',
];

// Etapas del pipeline v1 → v2 (renombrado acción-sobre-temperatura, ago 2026).
// Se usa para normalizar filas viejas de Supabase y localStorage del mock:
// los leads guardados con claves antiguas se re-mapean al leer, sin migrar.
export const LEGACY_TEMP_MAP: Record<string, Temperature> = {
  frio: 'en-contacto',
  tibio: 'en-contacto',
  caliente: 'negociando',
  reunion: 'negociando',
  'no-acepto': 'reactivacion',
};

/** Normaliza una etapa leída (filas viejas, encuestas, LLM) al union actual.
 *  Valor desconocido → 'nuevo' (nunca saca al lead del tablero). */
export const normalizeTemperature = (t: string | null | undefined): Temperature => {
  const key = (t ?? '') as string;
  if (STAGES.some((s) => s.key === key)) return key as Temperature;
  return LEGACY_TEMP_MAP[key] ?? 'nuevo';
};

export const stageConfig = (t: Temperature): StageConfig =>
  STAGES.find((s) => s.key === t) ?? STAGES[0];

export const stageLabel = (t: Temperature): string => stageConfig(t).label;

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
export const SOURCES: { key: Source; label: string }[] = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'referido', label: 'Referido' },
  { key: 'web', label: 'Sitio web' },
  { key: 'evento', label: 'Evento' },
  { key: 'llamada', label: 'Llamada' },
  { key: 'scraper', label: 'Scraper AI' },
  { key: 'meta', label: 'Facebook / Meta' },
  { key: 'otro', label: 'Otro' },
];

export const sourceLabel = (s: Source): string =>
  SOURCES.find((x) => x.key === s)?.label ?? s;

// ---------------------------------------------------------------------------
// Agency service lines
// ---------------------------------------------------------------------------
export const SERVICES: { key: Service; label: string }[] = [
  { key: 'web', label: 'Sitio web' },
  { key: 'aaas', label: 'AI Agent' },
  { key: 'app', label: 'App / Software' },
  { key: 'ecommerce', label: 'E-commerce' },
  { key: 'branding', label: 'Branding / Diseño' },
  { key: 'marketing', label: 'Marketing / Ads' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'consultoria', label: 'Consultoría' },
  { key: 'otro', label: 'Otro' },
];

export const serviceLabel = (s: Service): string =>
  SERVICES.find((x) => x.key === s)?.label ?? s;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const CADENCES: { key: TaskCadence; label: string; hint: string }[] = [
  { key: 'daily', label: 'Diarias', hint: 'Se reinician cada día' },
  { key: 'weekly', label: 'Semanales', hint: 'Objetivos de la semana' },
  { key: 'monthly', label: 'Mensuales', hint: 'Metas del mes' },
];

export const cadenceLabel = (c: TaskCadence): string =>
  CADENCES.find((x) => x.key === c)?.label ?? c;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const roleLabel = (r: Role): string =>
  r === 'admin' ? 'Administrador' : 'Staff';

// Avatar palette used when creating users
export const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
];
