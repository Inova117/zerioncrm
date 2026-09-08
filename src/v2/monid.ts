// ============================================================================
// V2 — Cliente Monid (independiente del Minero V1).
// ----------------------------------------------------------------------------
// Llama a la Edge Function `monid` (supabase/functions/monid/index.ts), que
// guarda MONID_API_KEY server-side. El navegador NUNCA ve la key.
//
// NO toca el minero V1 (find-leads / enrich-linkedin / prospectosService):
// plan B con Apify queda intacto. Esto es el V2 pay-per-use sobre Monid.
// ============================================================================
import { supabase } from '../lib/supabaseClient';

// --- tipos de salida (paridad con las señales del Minero + nuevos campos) ----

export interface MonidPlace {
  placeId: string | null;
  company: string | null;
  address?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  type?: string | null;
  website?: string | null;
  phone?: string | null;
}

/** Señales de facturación enriquecidas via Monid (V2). */
export interface MonidSignals {
  empleados?: number;
  /** Proxy de antigüedad: 3 = "establecida" (Crunchbase founded_on presente). */
  antiguedad?: number;
  /** Año de fundación exacto (PDL). */
  founded?: number;
  /** true cuando antiguedad es heurística (no año exacto). */
  antiguedadProxy?: boolean;
  size?: string;
  companyType?: string;
  headquarters?: string;
  industry?: string;
  website?: string;
  email?: string;
  emails?: Array<{ email?: string; type?: string; confidence?: number; position?: string }>;
  status?: string;
  description?: string;
  crunchbaseEmployees?: string;
  linkedinUrl?: string;
  totalFunding?: number;
  fundingStage?: string;
  // errores parciales (no tumban el enriquecimiento completo):
  linkedinError?: string;
  emailError?: string;
  crunchbaseError?: string;
}

export interface MonidSearchResult {
  places: MonidPlace[];
  cost: { value: number; currency: string } | null;
  provider: string;
}

export interface MonidEnrichResult {
  signals: MonidSignals;
  provider: string;
}

// ---------------------------------------------------------------------------
// invoke helper (mismo patrón de services/leadFinderService.ts)
// ---------------------------------------------------------------------------
async function invoke(action: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('Supabase no configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  const { data, error } = await supabase.functions.invoke('monid', { body: { action, ...body } });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    if (ctx?.json) {
      try {
        const j = await ctx.json();
        if (j?.error) message = j.error;
      } catch {
        /* keep the generic message */
      }
    }
    throw new Error(message);
  }
  return (data ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API pública V2
// ---------------------------------------------------------------------------

/** Buscador Google Maps via Monid (V2). */
export async function monidSearch(
  businessType: string,
  location: string,
  limit = 15,
): Promise<MonidSearchResult> {
  const res = await invoke('search', { businessType, location, limit });
  return {
    places: (res.places as MonidPlace[]) ?? [],
    cost: (res.cost as MonidSearchResult['cost']) ?? null,
    provider: String(res.provider ?? 'monid'),
  };
}

/** Enriquecimiento de señales de facturación via Monid (V2). */
export async function monidEnrich(opts: {
  linkedinUrl?: string;
  domain?: string;
}): Promise<MonidSignals> {
  const res = await invoke('enrich', {
    linkedinUrl: opts.linkedinUrl,
    domain: opts.domain,
  });
  return (res.signals as MonidSignals) ?? {};
}

/** Saldo Monid del workspace (cost-awareness). */
export async function monidBalance(): Promise<{ balance: { value: number; currency: string } }> {
  return (await invoke('balance', {})) as { balance: { value: number; currency: string } };
}

// ---------------------------------------------------------------------------
// Capacidades "kill switch" — un endpoint por software que reemplazamos.
// ---------------------------------------------------------------------------

/** Búsqueda de personas (mata Clay/Apollo). Clay query-mode o Apollo api_search. */
export async function monidPeople(opts: {
  query?: string;
  personTitles?: string[];
  keywords?: string;
  companyDomain?: string;
}): Promise<Record<string, unknown>> {
  return invoke('people', { ...opts });
}

/** Enriquecimiento completo de empresa — firmographics/funding/tech (mata PDL/Akta). */
export async function monidFirm(website: string): Promise<{ senales?: MonidSignals; cost?: unknown; [k: string]: unknown }> {
  return invoke('firma', { website }) as Promise<{ senales?: MonidSignals; cost?: unknown; [k: string]: unknown }>;
}

/** Decision-makers + emails laborales de una empresa (mata ContactOut). */
export async function monidDecisionMakers(company: string): Promise<Record<string, unknown>> {
  return invoke('decision-makers', { company });
}

/** Revela emails/phones de los decision-makers de una empresa (reveal=true, ~$0.07/email). */
export async function monidReveal(company: string): Promise<Record<string, unknown>> {
  return invoke('reveal', { company });
}

// ---------------------------------------------------------------------------
// ORQUESTACIÓN — un solo disparo que decide la cadena de tools.
// ---------------------------------------------------------------------------

export interface OrchestrateLead {
  company: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  empleados: number | null;
  founded: number | null;
  antiguedad: number | null;
  size: string | null;
  industry: string | null;
  totalFunding: number | null;
  email: string | null;
  emails: Array<{ email?: string }>;
  nivel: 'sostiene' | 'probable' | 'no' | 'sin-datos';
  score: number | null;
  decisionMakers?: Array<Record<string, unknown>>;
  revealed?: boolean;
}

export interface OrchestrateResult {
  intent: { niche: string; city: string; objetivo: string };
  total: number;
  matched: number;
  leads: OrchestrateLead[];
}

/** "dame dentistas en Quito que sostengan el ticket" → pipeline completo. */
export async function monidOrchestrate(
  text: string,
  opts: { maxLeads?: number } = {},
): Promise<OrchestrateResult> {
  const res = await invoke('orchestrate', { text, maxLeads: opts.maxLeads });
  if ((res as { error?: string })?.error) throw new Error((res as { error: string }).error);
  return res as unknown as OrchestrateResult;
}