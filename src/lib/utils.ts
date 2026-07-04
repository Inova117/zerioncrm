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
export const uid = (prefix = ''): string =>
  `${prefix}${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

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
