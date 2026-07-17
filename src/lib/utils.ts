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
import { AVATAR_COLORS } from './constants';

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

// ---------------------------------------------------------------------------
// Prospect UX helpers
// ---------------------------------------------------------------------------
/** Whole days since an ISO date (Infinity if never). */
export const daysSince = (iso: string | null | undefined): number =>
  iso ? Math.floor((Date.now() - parseISO(iso).getTime()) / 86_400_000) : Infinity;

export type FollowUp = 'fresh' | 'due' | 'stale';
/** Follow-up "traffic light": fresh ≤3d, due ≤7d, stale after that. */
export const followUpLevel = (lastContactAt: string | null | undefined): FollowUp => {
  const d = daysSince(lastContactAt);
  if (d <= 3) return 'fresh';
  if (d <= 7) return 'due';
  return 'stale';
};

/** Deterministic brand color for a company name (so its avatar is stable). */
export const colorFromString = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

// Contact deep-links (open the user's mail/phone/WhatsApp app).
export const mailLink = (email: string) => `mailto:${email.trim()}`;
export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/[^\d]/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const webLink = (site: string) =>
  /^https?:\/\//i.test(site) ? site : `https://${site}`;

/** Google Maps listing link for a scraped lead — from the stored URL, or built
 * from the place_id (so leads found before we captured the URL still link). */
export const googleMapsUrl = (
  e?: { googleUrl?: string; placeId?: string } | null
): string | null =>
  e?.googleUrl || (e?.placeId ? `https://www.google.com/maps/place/?q=place_id:${e.placeId}` : null);

/** Digits-only phone key for dedupe. Mirrors the scraper/Edge Function:
 * US 10-digit numbers get a leading 1 so formats collide; <7 digits → null. */
export const normalizePhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, '');
  if (d.length < 7) return null;
  return d.length === 10 ? `1${d}` : d;
};
