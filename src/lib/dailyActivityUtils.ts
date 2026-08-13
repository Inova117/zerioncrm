// ============================================================================
// Utilidades de la actividad diaria del vendedor (puras, testeables).
// ============================================================================
import type { DailyActivity } from '../types';

/** YYYY-MM-DD en fecha LOCAL (no UTC — el día del vendedor es el suyo). */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lunes de la semana de `d` (fecha local). */
export function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // lunes=0 … domingo=6
  out.setDate(out.getDate() - dow);
  return out;
}

/** Días laborables (lunes a viernes) de la semana de `d`, en orden. */
export function weekDays(d: Date): Date[] {
  const m = mondayOf(d);
  return [0, 1, 2, 3, 4].map((i) => {
    const day = new Date(m);
    day.setDate(m.getDate() + i);
    return day;
  });
}

export interface ActivityTotals {
  calls: number;
  contacts: number;
  demos: number;
  closes: number;
  /** Días con registro (cualquier campo > 0 o nota). */
  daysLogged: number;
  /** Tasa contacto/calls, demo/calls y cierre/demos en % (0-100, redondeado). */
  contactRate: number;
  demoRate: number;
  closeRate: number;
}

/** Totales + ratios de un conjunto de registros (una semana, un rango…). */
export function activityTotals(rows: DailyActivity[]): ActivityTotals {
  const calls = rows.reduce((s, r) => s + r.calls, 0);
  const contacts = rows.reduce((s, r) => s + r.contacts, 0);
  const demos = rows.reduce((s, r) => s + r.demos, 0);
  const closes = rows.reduce((s, r) => s + r.closes, 0);
  const daysLogged = rows.filter((r) => r.calls + r.contacts + r.demos + r.closes > 0 || r.notes.trim()).length;
  const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0);
  return {
    calls,
    contacts,
    demos,
    closes,
    daysLogged,
    contactRate: pct(contacts, calls),
    demoRate: pct(demos, calls),
    closeRate: pct(closes, demos),
  };
}

/** Devuelve el registro del día o null. */
export function rowForDay(rows: DailyActivity[], day: string): DailyActivity | null {
  return rows.find((r) => r.day === day) ?? null;
}
