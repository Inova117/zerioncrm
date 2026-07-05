import { clsx, type ClassValue } from 'clsx';
import {
  format,
  formatDistanceToNow,
  isToday,
  isThisWeek,
  isThisMonth,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';

/** Tailwind-friendly conditional classnames. */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** Collision-resistant enough id for the mock layer. Supabase will use gen_random_uuid(). */
let uidSeq = 0;
export const uid = (prefix = ''): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}${crypto.randomUUID()}`;
  }
  // Fallback for non-secure contexts: time + monotonic counter + randomness so
  // two ids created in the same tick can't collide. (bug #25)
  uidSeq = (uidSeq + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}-${uidSeq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const nowISO = (): string => new Date().toISOString();

export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export const fmtDate = (iso: string | null | undefined, pattern = "d 'de' MMM"): string =>
  iso ? format(parseISO(iso), pattern, { locale: es }) : '—';

export const fmtDateTime = (iso: string | null | undefined): string =>
  iso ? format(parseISO(iso), "d MMM yyyy · HH:mm", { locale: es }) : '—';

export const fromNow = (iso: string | null | undefined): string =>
  iso ? formatDistanceToNow(parseISO(iso), { locale: es, addSuffix: true }) : '—';

export const inCadenceWindow = (
  iso: string | null | undefined,
  cadence: 'daily' | 'weekly' | 'monthly'
): boolean => {
  if (!iso) return true;
  const d = parseISO(iso);
  if (cadence === 'daily') return isToday(d);
  if (cadence === 'weekly') return isThisWeek(d, { weekStartsOn: 1 });
  return isThisMonth(d);
};

/**
 * Should a task appear in its cadence column right now?
 *  - With an explicit due date → ALWAYS visible (never hide a dated task, even if
 *    overdue — the user must be able to complete or delete it).
 *  - Without a due date → it's a recurring task that resets by creation window.
 * Used by BOTH the Tasks board and the Dashboard so their counts always match.
 */
export const taskIsCurrent = (task: {
  dueDate: string | null;
  createdAt: string;
  cadence: 'daily' | 'weekly' | 'monthly';
}): boolean => (task.dueDate != null ? true : inCadenceWindow(task.createdAt, task.cadence));

/** A dated, not-yet-done task whose due date has already passed. */
export const isOverdue = (dueDate: string | null, done: boolean): boolean =>
  !done && dueDate != null && parseISO(dueDate).getTime() < Date.now();

export const fmtMoney = (n: number): string =>
  n > 0
    ? new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(n)
    : '—';

export const fmtCompact = (n: number): string =>
  new Intl.NumberFormat('es-MX', { notation: 'compact' }).format(n);

export const pct = (part: number, total: number): number =>
  total <= 0 ? 0 : Math.round((part / total) * 100);
