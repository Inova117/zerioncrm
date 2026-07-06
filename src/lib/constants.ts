import type { Temperature, Source, TaskCadence, Role } from '../types';

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
    description: 'Aún sin contactar',
    color: '#64748b',
    dot: 'bg-surface-400',
    ring: 'border-surface-300',
    soft: 'bg-surface-100',
    text: 'text-surface-600',
  },
  {
    key: 'frio',
    label: 'Frío',
    description: 'Contactado, sin respuesta',
    color: '#3b82f6',
    dot: 'bg-frio',
    ring: 'border-blue-300',
    soft: 'bg-blue-50',
    text: 'text-blue-600',
  },
  {
    key: 'tibio',
    label: 'Tibio',
    description: 'Respondió, hay interés',
    color: '#f59e0b',
    dot: 'bg-tibio',
    ring: 'border-amber-300',
    soft: 'bg-amber-50',
    text: 'text-amber-600',
  },
  {
    key: 'caliente',
    label: 'Caliente',
    description: 'Muy interesado, negociando',
    color: '#ef4444',
    dot: 'bg-caliente',
    ring: 'border-red-300',
    soft: 'bg-red-50',
    text: 'text-red-600',
  },
  {
    key: 'reunion',
    label: 'Reunión',
    description: 'Reunión agendada / realizada',
    color: '#8b5cf6',
    dot: 'bg-reunion',
    ring: 'border-violet-300',
    soft: 'bg-violet-50',
    text: 'text-violet-600',
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
  'frio',
  'tibio',
  'caliente',
  'reunion',
  'cliente',
  'perdido',
];

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
  { key: 'otro', label: 'Otro' },
];

export const sourceLabel = (s: Source): string =>
  SOURCES.find((x) => x.key === s)?.label ?? s;

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
