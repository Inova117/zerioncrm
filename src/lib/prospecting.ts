// ============================================================================
// prospecting — scoring de oportunidad, estadísticas de nicho y mensaje frío
// del sistema de prospección integrado (kit prospeccion-clientes).
// Lógica PURA (sin React/Supabase) → testeable con vitest.
// ============================================================================
import type { Discovery } from '../types';
import { fillLeadVars } from './scriptUtils';

export type ProspectionService = 'web' | 'seo' | 'marketing';

/** Nivel digital legible para badges (alineado al kit). */
export type DigitalLevel = 'critico' | 'alto' | 'medio' | 'bajo';

export function digitalLevel(score: number): DigitalLevel {
  if (score >= 85) return 'critico';
  if (score >= 70) return 'alto';
  if (score >= 50) return 'medio';
  return 'bajo';
}

/**
 * Score de oportunidad 0-100 según el servicio que se vende. Reglas del kit
 * prospeccion-clientes, adaptadas a los datos que tenemos (technical del
 * analyze-site). Nunca inventa: sin technical, buckets conservadores.
 */
export function opportunityScore(d: Discovery, service: ProspectionService): number {
  const t = d.enrichment?.technical ?? null;
  const hasWeb = Boolean(String(d.website ?? '').trim());

  if (service === 'web') {
    if (!hasWeb) return 95 + ratingBonus(d); // oportunidad máxima
    if (!t) return 70; // web declarada, aún sin analizar → incertidumbre media
    if (!t.accessible) return 70 + Math.min(17, ratingBonus(d)); // no se pudo ver → no inventar
    if (t.certExpired) return 88 + Math.min(6, ratingBonus(d));
    if (!t.hasViewport) return 80 + Math.min(9, ratingBonus(d));
    if (!t.hasMetaDescription || !t.hasH1) return 75 + Math.min(10, ratingBonus(d));
    if (t.loadTimeMs > 3000) return 65 + Math.min(14, ratingBonus(d));
    if (!t.openGraph && t.stackHints.length === 0) return 55 + Math.min(14, ratingBonus(d));
    return 20 + Math.min(29, ratingBonus(d) + 14); // moderna: oportunidad baja
  }

  if (service === 'seo') {
    if (!t) return 60;
    const missing = (!t.title ? 1 : 0) + (!t.hasMetaDescription ? 1 : 0) + (!t.hasH1 ? 1 : 0);
    if (missing === 3) return 90 + Math.min(10, ratingBonus(d));
    if (missing === 2) return 70 + Math.min(19, ratingBonus(d));
    if (missing === 1) return 40 + Math.min(19, ratingBonus(d));
    return 10 + Math.min(19, ratingBonus(d));
  }

  // marketing: oportunidad = sin redes / presencia social pobre
  const socials = t?.socials ?? [];
  if (!t && !hasWeb) return 95 + ratingBonus(d);
  if (!t) return 55;
  if (socials.length === 0) return 90 + Math.min(10, ratingBonus(d));
  if (socials.length <= 2) return 45 + Math.min(14, ratingBonus(d));
  return 25 + Math.min(29, ratingBonus(d));
}

/** Bonus 0-10 por reseñas (negocio vivo = dueño que responde). */
function ratingBonus(d: Discovery): number {
  const n = d.enrichment?.reviewCount ?? 0;
  if (n >= 100) return 10;
  if (n >= 30) return 5;
  return 0;
}

// --- Problemas detectados (para fichas y mensajes) ---------------------------

export function issuesOf(d: Discovery): string[] {
  const t = d.enrichment?.technical ?? null;
  const hasWeb = Boolean(String(d.website ?? '').trim());
  const issues: string[] = [];

  if (!hasWeb) {
    issues.push('No tiene página web: sus clientes no lo encuentran en Google');
    return issues;
  }
  if (!t) {
    issues.push('Tiene web declarada pero aún sin analizar');
    return issues;
  }
  if (!t.accessible) {
    issues.push(`Su web no respondió al análisis${t.error ? ` (${t.error})` : ''}`);
    return issues;
  }
  if (t.certExpired) issues.push('El certificado de seguridad está vencido: el navegador bloquea la entrada');
  if (!t.hasViewport) issues.push('La página no es responsive: se ve mal en el celular');
  if (!t.title) issues.push('No tiene título de página: Google no sabe qué muestra');
  if (!t.hasMetaDescription) issues.push('Sin descripción en Google: el enlace aparece sin texto');
  if (!t.hasH1) issues.push('Sin encabezado principal (H1): Google no identifica el tema');
  if (t.loadTimeMs > 3000) issues.push(`Página lenta (${(t.loadTimeMs / 1000).toFixed(1)}s): la gente se va antes de verla`);
  if (t.socials.length === 0) issues.push('Sin redes sociales enlazadas');
  return issues.length ? issues : ['Su web está bien montada — competir es subir el estándar del sector'];
}

// --- Estadísticas del nicho ---------------------------------------------------

export interface NicheStats {
  total: number;
  withoutWebsite: number;
  httpsBroken: number; // cert vencido entre las analizadas
  seoMissing: number; // sin title o sin meta o sin h1
  withoutSocials: number;
  analyzed: number;
  avgScore: number; // promedio (servicio web)
  hot: number; // score >= 85
}

export function nichoStats(list: Discovery[]): NicheStats {
  let withoutWebsite = 0, httpsBroken = 0, seoMissing = 0, withoutSocials = 0, analyzed = 0, hot = 0;
  let sum = 0;
  for (const d of list) {
    const t = d.enrichment?.technical ?? null;
    const s = opportunityScore(d, 'web');
    sum += s;
    if (s >= 85) hot++;
    if (!String(d.website ?? '').trim()) { withoutWebsite++; continue; }
    if (t) {
      analyzed++;
      if (t.certExpired) httpsBroken++;
      if (!t.title || !t.hasMetaDescription || !t.hasH1) seoMissing++;
      if (t.socials.length === 0) withoutSocials++;
    }
  }
  return {
    total: list.length,
    withoutWebsite,
    httpsBroken,
    seoMissing,
    withoutSocials,
    analyzed,
    avgScore: list.length ? Math.round(sum / list.length) : 0,
    hot,
  };
}

// --- Mensaje frío de primer contacto -------------------------------------------
// Alineado al guion co-diseñado: curiosidad genuina, voz USTED, cumplido con
// reseñas reales del scraper, SIN precios (el precio se maneja en la llamada).
// Sin [SALUDO]: sin nombre de contacto resolvería a «Buenas», prohibido en el
// guion — se abre directo con «Le escribo porque…».

const COLD_TEMPLATE = `Le escribo porque vi a [EMPRESA] en Google ([RESEÑAS]) y noté que [PROBLEMA]. ¿Podría preguntarle la razón? Trabajo con negocios de [CIUDAD] y me encargaría de arreglar eso sin que usted haga nada. No le cobro nada por verla: le preparo una muestra con la página ya hecha y usted decide.`;

export function coldMessage(d: Discovery): string {
  const problem = issuesOf(d)[0] ?? 'su presencia en internet está desaprovechada';
  // minúscula tras "noté que" (el issue arranca en mayúscula)
  const lower = problem.charAt(0).toLowerCase() + problem.slice(1);
  return fillLeadVars(COLD_TEMPLATE.replace('[PROBLEMA]', lower), {
    company: d.company,
    enrichment: d.enrichment ?? null,
  });
}
