// ============================================================================
// prospecting — scoring de oportunidad, estadísticas de nicho y mensaje frío
// del sistema de prospección integrado (kit prospeccion-clientes).
// Lógica PURA (sin React/Supabase) → testeable con vitest.
//
// Desde Fase 2 de "prospección automática por servicio", el scoring se expone
// como funciones primitivas (webScore / agentScore) para duplicarlas en la
// edge function analyze-site con paridad (bloque scoring-pure, test-pure.mjs).
// ============================================================================
import type { Discovery, OfferLine, SiteTechnical } from '../types';
import { nicheFor } from './nicheCatalog';
import type { NichePrimary } from './nicheCatalog';
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

// ---------------------------------------------------------------------------
// webScore — necesidad de página web (0-100). Primitiva pura para paridad.
// ---------------------------------------------------------------------------

export interface WebScoreInput {
  website: string;
  technical?: SiteTechnical | null;
  reviewCount?: number;
}

/** Bonus 0-10 por reseñas (negocio vivo = dueño que responde). */
function reviewBonus(n: number): number {
  if (n >= 100) return 10;
  if (n >= 30) return 5;
  return 0;
}

export function webScore(input: WebScoreInput): number {
  const t = input.technical ?? null;
  const hasWeb = Boolean(String(input.website ?? '').trim());
  const bonus = reviewBonus(input.reviewCount ?? 0);

  if (!hasWeb) return Math.min(100, 95 + bonus); // oportunidad máxima
  if (!t) return 70; // web declarada, aún sin analizar → incertidumbre media
  if (!t.accessible) return 70 + Math.min(17, bonus); // no se pudo ver → no inventar
  if (t.certExpired) return 88 + Math.min(6, bonus);
  if (!t.hasViewport) return 80 + Math.min(9, bonus);
  if (!t.hasMetaDescription || !t.hasH1) return 75 + Math.min(10, bonus);
  if (t.loadTimeMs > 3000) return 65 + Math.min(14, bonus);
  if (!t.openGraph && t.stackHints.length === 0) return 55 + Math.min(14, bonus);
  return 20 + Math.min(29, bonus + 14); // moderna: oportunidad baja
}

// ---------------------------------------------------------------------------
// agentScore — necesidad de secretaria virtual / AI agent (0-100).
// Señales proxy del scraper (Gmaps/Apify): volumen de reseñas, rating, nicho,
// precio, canal activo. Más ruidosa que webScore; se documenta la incertidumbre.
// ---------------------------------------------------------------------------

export interface AgentScoreInput {
  nichePrimary: NichePrimary; // de nicheCatalog
  reviewCount?: number;
  rating?: number;
  price?: string;
  hasPhone: boolean;
}

export function agentScore(input: AgentScoreInput): number {
  const { nichePrimary, reviewCount = 0, rating, price, hasPhone } = input;
  let s = 0;

  if (reviewCount >= 100) s += 40;
  else if (reviewCount >= 30) s += 25;
  else if (reviewCount >= 10) s += 10;

  if (rating != null) {
    if (rating >= 4.5) s += 20;
    else if (rating >= 4.0) s += 10;
  }

  if (nichePrimary === 'aaas') s += 20; // nicho de agendamiento
  // 'ambigua' (restaurantes) → compite en igualdad (ni bonus ni penalización)

  if (price === '$$$') s += 15;
  else if (price === '$$') s += 10;

  if (hasPhone) s += 5;

  if (nichePrimary === 'web') s -= 50; // no se le ofrece agente a un abogado

  return Math.max(0, Math.min(100, s));
}

/** Línea de oferta ganadora: gana el score mayor (regla de decisión dual). */
export function offerLine(web: number, agent: number): OfferLine {
  return web >= agent ? 'web' : 'aaas';
}

// ---------------------------------------------------------------------------
// Umbrales de entrega (configurables por campaña y servicio).
// ---------------------------------------------------------------------------

export const DEFAULT_THRESHOLDS: Record<OfferLine, number> = { web: 70, aaas: 70 };

export function meetsThreshold(
  service: OfferLine,
  score: number,
  thresholds: Partial<Record<OfferLine, number>> = DEFAULT_THRESHOLDS
): boolean {
  return score >= (thresholds[service] ?? 70);
}

// ---------------------------------------------------------------------------
// opportunityScore — API original (backwards-compatible) para la UI.
// ---------------------------------------------------------------------------

export function opportunityScore(d: Discovery, service: ProspectionService): number {
  if (service === 'web') {
    return webScore({
      website: d.website,
      technical: d.enrichment?.technical ?? null,
      reviewCount: d.enrichment?.reviewCount ?? 0,
    });
  }

  const t = d.enrichment?.technical ?? null;
  const hasWeb = Boolean(String(d.website ?? '').trim());
  const bonus = reviewBonus(d.enrichment?.reviewCount ?? 0);

  if (service === 'seo') {
    if (!t) return 60;
    const missing = (!t.title ? 1 : 0) + (!t.hasMetaDescription ? 1 : 0) + (!t.hasH1 ? 1 : 0);
    if (missing === 3) return Math.min(100, 90 + Math.min(10, bonus));
    if (missing === 2) return Math.min(100, 70 + Math.min(19, bonus));
    if (missing === 1) return Math.min(100, 40 + Math.min(19, bonus));
    return Math.min(100, 10 + Math.min(19, bonus));
  }

  // marketing: oportunidad = sin redes / presencia social pobre
  const socials = t?.socials ?? [];
  if (!t && !hasWeb) return Math.min(100, 95 + bonus);
  if (!t) return 55;
  if (socials.length === 0) return Math.min(100, 90 + Math.min(10, bonus));
  if (socials.length <= 2) return 45 + Math.min(14, bonus);
  return 25 + Math.min(29, bonus);
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
// Tono neutro formal sin regionalismos: «su negocio / le escribo», SIN la
// palabra «usted». Sin [SALUDO]: sin nombre resolvería a «Buenas», prohibido.

const COLD_TEMPLATE = `Le escribo porque vi a [EMPRESA] en Google ([RESEÑAS]) y noté que [PROBLEMA]. ¿Podría preguntarle la razón? Trabajo con negocios de [CIUDAD] y me encargaría de arreglar eso sin que tenga que hacer nada. No le cobro nada por verla: le preparo una muestra con la página ya hecha y decide.`;

export function coldMessage(d: Discovery): string {
  const problem = issuesOf(d)[0] ?? 'su presencia en internet está desaprovechada';
  // minúscula tras "noté que" (el issue arranca en mayúscula)
  const lower = problem.charAt(0).toLowerCase() + problem.slice(1);
  return fillLeadVars(COLD_TEMPLATE.replace('[PROBLEMA]', lower), {
    company: d.company,
    enrichment: d.enrichment ?? null,
  });
}

// --- Mensaje frío para AI agent (misma voz, dolor de atención) ----------------

const AGENT_TEMPLATE = `Le escribo porque vi a [EMPRESA] en Google con [RESEÑAS] y [RATING] — ese volumen de clientes suele saturar el WhatsApp. ¿Le pasaría? Le muestro en 2 minutos cómo una secretaria virtual responde, agenda y hace el seguimiento mientras atiende. Le preparo la misma demo que ya usan otros negocios de [CIUDAD] y decide.`;

export function agentMessage(d: Discovery): string {
  return fillLeadVars(AGENT_TEMPLATE, {
    company: d.company,
    enrichment: d.enrichment ?? null,
  });
}

// --- Servicio ganador + mensaje + score (informe y UI) -----------------------

/** Servicio ganador de un discovery: usa el `offer` persistido o lo recalcula
 *  con el scoring dual (cubre mock y discoveries viejos sin offer). */
export function offerOf(d: Discovery): OfferLine {
  const e = d.enrichment;
  if (e?.offer === 'web' || e?.offer === 'aaas') return e.offer;
  const niche = nicheFor(d.industry ?? '');
  const web = webScore({ website: d.website, technical: e?.technical ?? null, reviewCount: e?.reviewCount ?? 0 });
  const agent = agentScore({
    nichePrimary: niche,
    reviewCount: e?.reviewCount ?? 0,
    rating: e?.rating,
    price: e?.price,
    hasPhone: Boolean(d.phone),
  });
  return offerLine(web, agent);
}

/** Mensaje frío correcto según el servicio ganador. */
export function offerMessage(d: Discovery): string {
  return offerOf(d) === 'aaas' ? agentMessage(d) : coldMessage(d);
}

/** Score del servicio ganador (para barras y ordenación del informe). */
export function offerScore(d: Discovery): number {
  const e = d.enrichment;
  if (offerOf(d) === 'aaas') {
    if (e?.agentScore != null) return e.agentScore;
    return agentScore({
      nichePrimary: nicheFor(d.industry ?? ''),
      reviewCount: e?.reviewCount ?? 0,
      rating: e?.rating,
      price: e?.price,
      hasPhone: Boolean(d.phone),
    });
  }
  return webScore({ website: d.website, technical: e?.technical ?? null, reviewCount: e?.reviewCount ?? 0 });
}
