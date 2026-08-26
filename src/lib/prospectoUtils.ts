import type { Prospecto, ProspectoTemperatura, ProspectoSegment } from '../types';
import { mailLink, telLink, waLink, webLink } from './utils';

// ============================================================================
// Minero de Prospectos — lógica pura (sin React, testeable).
// Temperatura, rutas de contacto por canal (LinkedIn → email → WhatsApp →
// teléfono → web), búsqueda/filtros y mensaje frío.
// ============================================================================

export const TEMP_CONFIG: Record<
  ProspectoTemperatura,
  { label: string; hex: string; chip: string; dot: string }
> = {
  prioritario: { label: 'Prioritario', hex: '#ef4444', chip: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  caliente: { label: 'Caliente', hex: '#f59e0b', chip: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  tibio: { label: 'Tibio', hex: '#3b82f6', chip: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  frio: { label: 'Frío', hex: '#64748b', chip: 'bg-surface-100 text-surface-500', dot: 'bg-surface-400' },
};

export const SEGMENTS: { key: ProspectoSegment; label: string }[] = [
  { key: 'colegio', label: 'Colegio' },
  { key: 'preuniversitario', label: 'Preuniversitario' },
  { key: 'academia', label: 'Academia' },
  { key: 'instituto', label: 'Instituto' },
  { key: 'capacitacion', label: 'Capacitación' },
  { key: 'otro', label: 'Otro' },
];
export const segmentLabel = (s: ProspectoSegment): string =>
  SEGMENTS.find((x) => x.key === s)?.label ?? s;

/** 85+ prioritario · 70-84 caliente · 50-69 tibio · <50 frío (espejo del modelo). */
export function computeTemperatura(score: number): ProspectoTemperatura {
  if (score >= 85) return 'prioritario';
  if (score >= 70) return 'caliente';
  if (score >= 50) return 'tibio';
  return 'frio';
}

export interface ContactRoute {
  channel: 'linkedin' | 'email' | 'whatsapp' | 'whatsapp' | 'telefono' | 'web';
  label: string;
  href: string;
}

/** Canales disponibles de contacto, ordenados por preferencia de outreach:
 *  LinkedIn (mejor ruta B2B) → email → WhatsApp → teléfono → web. */
export function contactRoutes(p: Prospecto): ContactRoute[] {
  const c = p.contact;
  const routes: ContactRoute[] = [];
  if (c?.linkedin) routes.push({ channel: 'linkedin', label: 'LinkedIn', href: c.linkedin });
  if (c?.email && c.email.includes('@'))
    routes.push({ channel: 'email', label: 'Email', href: mailLink(c.email) });
  if (c?.whatsapp)
    routes.push({ channel: 'whatsapp', label: 'WhatsApp', href: waLink(c.whatsapp) });
  if (c?.telefono)
    routes.push({ channel: 'telefono', label: 'Teléfono', href: telLink(c.telefono) });
  if (c?.web || p.website)
    routes.push({ channel: 'web', label: 'Sitio web', href: webLink(c?.web ?? p.website ?? '') });
  return routes;
}

/** La mejor ruta de contacto (primera disponible por preferencia). */
export function bestRoute(p: Prospecto): ContactRoute | null {
  return contactRoutes(p)[0] ?? null;
}

export interface ProspectoFilters {
  q?: string;
  segment?: ProspectoSegment | 'all';
  city?: string;
  temperatura?: ProspectoTemperatura | 'all';
  /** undefined = todos; true = solo objetivo; false = solo no-objetivo. */
  objetivo?: boolean;
}

/** Búsqueda + filtros combinados sobre la lista (puro). */
export function filterProspectos(list: Prospecto[], f: ProspectoFilters): Prospecto[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return list.filter((p) => {
    if (f.segment && f.segment !== 'all' && p.segment !== f.segment) return false;
    if (f.city && p.city.toLowerCase() !== f.city.toLowerCase()) return false;
    if (f.temperatura && f.temperatura !== 'all' && p.temperatura !== f.temperatura) return false;
    if (typeof f.objetivo === 'boolean' && p.objetivo !== f.objetivo) return false;
    if (q) {
      const hay = [p.company, p.city, p.segment, p.size, p.gap, p.website]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const uniqueCities = (list: Prospecto[]): string[] =>
  [...new Set(list.map((p) => p.city))].sort((a, b) => a.localeCompare(b));

/** Mensaje frío personalizado — tono neutro formal SIN «usted», sin precios,
 *  abre con "Le escribo porque…". Corto (4-5 líneas), demo-first honesto. */
export function mensajeFrio(p: Prospecto): string {
  const gapShort = (p.gap ?? '').split(/[·.;]+/)[0].trim();
  const motivo = gapShort ? `y noté que ${gapShort.toLowerCase()}` : 'y me pareció que podría interesarle lo que hacemos';
  return `Le escribo porque vi a ${p.company} ${motivo}. ¿Podría preguntarle cómo lo están resolviendo hoy? Soy de ZerionStudio y le traigo familias/estudiantes listos para matricular — le muestro su primer lote en 30 minutos, sin compromiso.`;
}
