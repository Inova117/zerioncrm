// ============================================================================
// Supabase Edge Function — monid (V2 — pasarela Monid pay-per-use)
// ----------------------------------------------------------------------------
// Reemplazo INDEPENDIENTE de find-leads/enrich-linkedin (V1 = Apify, plan B
// intacto). Una sola pasarela Monid para BUSCADOR (Google Maps) + ENRIQUECIMIENTO
// (señales de facturación: empleados, antigüedad, emails).
//
// La key de Monid vive server-side (MONID_API_KEY). El navegador NUNCA la ve.
//
// Endpoints (todos verificados en vivo contra api.monid.ai):
//   • empleados   → ploid/linkedin/company        $0.01  (queryParams: { url })
//                   out.data.element.employeeCount
//   • empleados·2 → tikhub/.../get_company_profile $0.012 (queryParams: { url })
//                   out.employees_in_linkedin
//   • emails      → hunterio/email-finder          $0.024 (queryParams: { domain })
//   • buscador    → apify/damilo/google-maps-scraper $0.0045/result (body: query/location)
//   • antigüedad  → indeed/get_company_profile      $0.01  (queryParams: { company })
//                   (campo founded sin confirmar campo exacto — marcar optional)
//
// Monid REST (clave, ver skill "monid"):
//   POST /v1/run  { provider, endpoint, input: { body?, queryParams?, pathParams? } } → { runId }
//   GET  /v1/runs/:id → { status, output, cost }
//   GET  /v1/wallet/balance
//   Auth: Authorization: Bearer <MONID_API_KEY>
//
// Deploy:  supabase functions deploy monid --project-ref kvgrjqszmfiylqwnuhpr
// Secret:  supabase secrets set MONID_API_KEY=monid_live_xxx
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERSION = '2026-09-07.1-orchestrate';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MONID_API_KEY = Deno.env.get('MONID_API_KEY') ?? '';

const MONID = 'https://api.monid.ai';
// 30s de techo por run individual (no 60s): en orquestación, un run colgado se
// multiplica por N leads y revienta el presupuesto de wall-clock (546) de la
// tier gratuita de Supabase. Menos techo = menos CPU/wall-clock total por corrida.
const RUN_TIMEOUT_MS = 30_000;
const POLL_MS = 1500;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'x-monid-version': VERSION,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ---------------------------------------------------------------------------
// Cliente Monid (fetch nativo — Deno)
// ---------------------------------------------------------------------------
interface MonidRunInput {
  provider: string;
  endpoint: string;
  input: {
    body?: unknown;
    queryParams?: Record<string, unknown>;
    pathParams?: Record<string, unknown>;
  };
}

interface MonidRun {
  runId?: string;
  status?: string;
  output?: unknown;
  cost?: { value: number; currency: string };
}

function requireKey() {
  if (!MONID_API_KEY) throw new Error('MONID_API_KEY no configurada en la Edge Function');
}

async function monidPost(path: string, body: unknown, attempt = 1): Promise<unknown> {
  const resp = await fetch(`${MONID}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MONID_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Monid-Client': 'zerion-v2',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  // 429 = rate limit de Monid (el orquestador dispara ~20 runs en ráfaga).
  // Reintentar con backoff exponencial (1s, 2s, 4s) en vez de morir → 502.
  if (resp.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    return monidPost(path, body, attempt + 1);
  }
  if (!resp.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message
      ?? (data as { message?: string })?.message
      ?? `Monid HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

async function monidGet(path: string, attempt = 1): Promise<unknown> {
  const resp = await fetch(`${MONID}${path}`, {
    headers: { Authorization: `Bearer ${MONID_API_KEY}` },
  });
  if (resp.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    return monidGet(path, attempt + 1);
  }
  return resp.json();
}

/** Fire + poll hasta COMPLETED (o terminal). */
async function monidRun(input: MonidRunInput): Promise<MonidRun> {
  requireKey();
  const req: Record<string, unknown> = { provider: input.provider, endpoint: input.endpoint };
  if (Object.keys(input.input).length) req.input = input.input;

  const started = (await monidPost('/v1/run', req)) as { runId?: string };
  const runId = started.runId;
  if (!runId) throw new Error('Monid no devolvió runId');

  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const run = (await monidGet(`/v1/runs/${encodeURIComponent(runId)}`)) as MonidRun;
    if (run.status === 'COMPLETED') return run;
    if (run.status === 'FAILED' || run.status === 'BLOCKED') {
      throw new Error(`Run Monid ${run.status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('Monid run superó los 60s');
}

// ---------------------------------------------------------------------------
// BUSCADOR — Google Maps via Monid (V2)
// ---------------------------------------------------------------------------
const MAPS_PROVIDER = 'apify';
const MAPS_ENDPOINT = '/damilo/google-maps-scraper';
const MAX_MAPS_RESULTS = 50;

interface MapsPlace {
  placeId?: string;
  cid?: string;
  title?: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  type?: string;
  types?: string[];
  website?: string;
  phoneNumber?: string;
}

async function searchMaps(businessType: string, location: string, limit: number) {
  const run = await monidRun({
    provider: MAPS_PROVIDER,
    endpoint: MAPS_ENDPOINT,
    input: {
      body: {
        query: businessType,
        location,
        max_results: Math.min(Math.max(limit, 1), MAX_MAPS_RESULTS),
        language: 'es',
      },
    },
  });

  const raw = Array.isArray(run.output) ? (run.output as MapsPlace[]) : [];
  const places = raw
    .filter((p) => p.placeId || p.cid || p.title)
    .slice(0, Math.min(limit, MAX_MAPS_RESULTS))
    .map((p) => ({
      placeId: p.placeId ?? p.cid ?? null,
      company: p.title ?? null,
      address: p.address ?? null,
      rating: typeof p.rating === 'number' ? p.rating : null,
      reviewCount: typeof p.ratingCount === 'number' ? p.ratingCount : null,
      type: p.type ?? (Array.isArray(p.types) ? p.types[0] : null) ?? null,
      website: p.website ?? null,
      phone: p.phoneNumber ?? null,
    }))
    .filter((p) => p.placeId && p.company);

  return { places, cost: run.cost ?? null };
}

// ---------------------------------------------------------------------------
// ENRIQUECIMIENTO — señales de facturación del Minero via Monid (V2)
// ---------------------------------------------------------------------------

interface PloidCompany {
  data?: {
    element?: {
      name?: string;
      employeeCount?: number;
      companyType?: string;
      industries?: Array<{ name?: string }>;
      locations?: Array<{ city?: string; country?: string }>;
      website?: string;
      linkedinUrl?: string;
    };
  };
}

interface TikhubCompany {
  name?: string;
  employees_in_linkedin?: number;
  company_size?: string;
  headquarters?: string;
}

interface CrunchbaseOrg {
  data?: {
    properties?: {
      num_employees_enum?: string;
      status?: string;
      short_description?: string;
    };
    preview_properties?: {
      founded_on?: { is_present?: boolean };
    };
  };
}

async function enrichCompany(opts: {
  linkedinUrl?: string;
  domain?: string;
}): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  // 1) empleados + firmographics desde LinkedIn (ploid → employeeCount).
  if (opts.linkedinUrl && /linkedin\.com\/company\//i.test(opts.linkedinUrl)) {
    try {
      const run = await monidRun({
        provider: 'ploid',
        endpoint: '/linkedin/company',
        input: { queryParams: { url: opts.linkedinUrl } },
      });
      const el = (run.output as PloidCompany)?.data?.element;
      if (el) {
        if (typeof el.employeeCount === 'number') out.empleados = el.employeeCount;
        if (el.companyType) out.companyType = el.companyType;
        const ind = el.industries?.map((i) => i.name).filter(Boolean);
        if (ind?.length) out.industry = ind[0];
        const loc = el.locations?.[0];
        if (loc) out.headquarters = [loc.city, loc.country].filter(Boolean).join(', ') || null;
        if (el.website) out.website = el.website;
      }
    } catch {
      // Fallback: tikhub devuelve employees_in_linkedin (número directo).
      try {
        const run2 = await monidRun({
          provider: 'tikhub',
          endpoint: '/api/v1/linkedin/web_v2/get_company_profile',
          input: { queryParams: { url: opts.linkedinUrl } },
        });
        const el2 = run2.output as TikhubCompany;
        if (typeof el2?.employees_in_linkedin === 'number') out.empleados = el2.employees_in_linkedin;
        if (el2?.company_size) out.size = el2.company_size;
        if (el2?.headquarters) out.headquarters = el2.headquarters;
      } catch (e2) {
        out.linkedinError = String(e2);
      }
    }
  }

  // 2) emails (Hunter domain-search) si hay dominio — Body, no queryParams.
  //    domain-search lista TODOS los emails publicados del dominio (mejor que
  //    email-finder, que exige full_name de una persona concreta).
  if (opts.domain) {
    try {
      const run = await monidRun({
        provider: 'hunterio',
        endpoint: '/domain-search',
        input: { body: { domain: opts.domain, limit: 5 } },
      });
      const data = (run.output as { data?: { emails?: Array<{ value?: string; type?: string; confidence?: number; first_name?: string; last_name?: string; position?: string }> } })?.data;
      const emails = data?.emails ?? [];
      if (emails.length) {
        // El email primario = el primero personal (o el primero, si no hay).
        const prim = emails.find((e) => e.type === 'personal') ?? emails[0];
        if (prim?.value) out.email = prim.value;
        out.emails = emails.map((e) => ({ email: e.value, type: e.type, confidence: e.confidence, position: e.position }));
      }
    } catch (e) {
      out.emailError = String(e);
    }
  }

  // 3) antigüedad + firmographics (Crunchbase) — proxy: si la org existe con
  //    founded_on presente + num_employees_enum, es "establecida" (≥3 años).
  //    NO da el año exacto (el campo founded_on llega solo como is_present).
  //    Se marca antiguedad=3 (tramo mínimo de ptsAntiguedad = 15) solo cuando
  //    hay evidencia real en Crunchbase — nunca inventamos un año.
  const slug = companySlugFrom(opts.domain, opts.linkedinUrl);
  if (slug) {
    try {
      const run = await monidRun({
        provider: 'crunchbase',
        endpoint: '/get_organization_profile',
        input: { queryParams: { slug } },
      });
      const props = (run.output as CrunchbaseOrg)?.data?.properties;
      const foundedPresent = (run.output as CrunchbaseOrg)?.data?.preview_properties?.founded_on?.is_present === true;
      const hasEmployees = typeof props?.num_employees_enum === 'string' && props.num_employees_enum.startsWith('c_');
      // Solo marcamos "establecida" si Crunchbase conoce la org Y reporta fundación.
      if (props && foundedPresent) {
        out.antiguedad = 3; // proxy conservador: mínimo tramo (≥3 años)
        out.antiguedadProxy = true; // marca explícita: es heurística, no año real
      }
      if (hasEmployees) out.crunchbaseEmployees = props?.num_employees_enum;
      if (props?.status) out.status = props.status;
      if (props?.short_description) out.description = props.short_description;
    } catch (e) {
      // Crunchbase es best-effort: un 404 (slug no existe) no tumba el resto.
      out.crunchbaseError = String(e);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// PERSONAS — search de prospects (Clay query-mode / Apollo search). Mata Clay
// y Apollo: busca personas por título, seniority, empresa, tamaño de empresa.
// ---------------------------------------------------------------------------
interface PeopleSearchOptions {
  query?: string; // Clay advanced query (select from people where ...)
  personTitles?: string[]; // Apollo person_titles[]
  keywords?: string; // Apollo q_keywords
  companyDomain?: string; // Apollo q_organization_domains_list[]
  limit?: number;
}

async function searchPeople(opts: PeopleSearchOptions): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  // Clay (query-mode → run): 2 pasos. Crear search (gratis) → paginar resultados.
  if (opts.query) {
    try {
      const create = await monidRun({
        provider: 'clay',
        endpoint: '/search/query-mode',
        input: { body: { query: opts.query } },
      });
      const searchId = (create.output as { search_id?: string })?.search_id;
      if (searchId) {
        const page = await monidRun({
          provider: 'clay',
          endpoint: '/search/query-mode/run',
          input: { body: { search_id: searchId, limit: opts.limit ?? 25 } },
        });
        out.clay = page.output;
        if (page.cost) out.clayCost = page.cost;
      } else {
        out.clay = create.output;
      }
    } catch (e) {
      out.clayError = String(e);
    }
  }
  // Apollo (api_search): cuando hay títulos o keywords.
  if (opts.personTitles?.length || opts.keywords) {
    try {
      const q: Record<string, unknown> = {};
      if (opts.personTitles?.length) q['person_titles[]'] = opts.personTitles;
      if (opts.keywords) q.keywords = opts.keywords;
      if (opts.companyDomain) q['q_organization_domains_list[]'] = [opts.companyDomain];
      const run = await monidRun({
        provider: 'apollo',
        endpoint: '/mixed_people/api_search',
        input: { queryParams: q },
      });
      out.apollo = run.output;
      if (run.cost) out.apolloCost = run.cost;
    } catch (e) {
      out.apolloError = String(e);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// FIRMA — enriquecimiento completo de empresa (PDL). Mata Clay/Apollo/Akta:
// firmographics, funding, empleados, tech stack, socials en una llamada.
// PDL ES LA FUENTE DE `founded` (año exacto) → antigüedad real del Minero.
// ---------------------------------------------------------------------------
interface PdlCompany {
  status?: number;
  name?: string;
  employee_count?: number;
  founded?: number;
  size?: string;
  industry?: string;
  linkedin_url?: string;
  website?: string;
  total_funding_raised?: number;
  latest_funding_stage?: string;
  summary?: string;
}

async function enrichFirm(website: string): Promise<Record<string, unknown>> {
  const run = await monidRun({
    provider: 'pdl',
    endpoint: '/v5/company/enrich',
    input: { body: { website, min_likelihood: 1 } },
  });
  const p = run.output as PdlCompany;
  // Normalizar a las señales del Minero (mismo vocabulario que enrichCompany).
  const derived: Record<string, unknown> = {};
  if (typeof p.employee_count === 'number') derived.empleados = p.employee_count;
  if (typeof p.founded === 'number') {
    derived.founded = p.founded;
    derived.antiguedad = Math.max(0, new Date().getFullYear() - p.founded);
  }
  if (p.size) derived.size = p.size;
  if (p.industry) derived.industry = p.industry;
  if (p.linkedin_url) derived.linkedinUrl = p.linkedin_url;
  if (typeof p.total_funding_raised === 'number') derived.totalFunding = p.total_funding_raised;
  if (p.latest_funding_stage) derived.fundingStage = p.latest_funding_stage;

  return { pdl: run.output, senales: derived, cost: run.cost ?? null };
}

// ---------------------------------------------------------------------------
// DECISION-MAKERS — leadership de una empresa (ContactOut). Mata ContactOut.
// Input real: GET con queryParams { linkedin_url | domain | name, reveal_info }.
// ---------------------------------------------------------------------------
async function decisionMakers(companyRef: string, reveal = true): Promise<Record<string, unknown>> {
  const q: Record<string, unknown> = { reveal_info: reveal };
  // Detectar qué identificador es: linkedin_url / domain / name.
  if (/^https?:\/\//i.test(companyRef) && /linkedin\.com\/company\//i.test(companyRef)) {
    q.linkedin_url = companyRef;
  } else if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(companyRef)) {
    q.domain = companyRef;
  } else {
    q.name = companyRef;
  }
  const run = await monidRun({
    provider: 'contactout',
    endpoint: '/v1/people/decision-makers/work-email',
    input: { queryParams: q },
  });
  return { people: run.output, cost: run.cost ?? null };
}

/** Deriva un slug de Crunchbase desde el dominio o la URL de LinkedIn (best-effort). */
function companySlugFrom(domain?: string, linkedinUrl?: string): string | null {
  if (domain) {
    const host = domain.replace(/^www\./, '').replace(/\.com$|\.org$|\.net$|\.io$|\.co$|\.ec$|\.mx$|\.es$/i, '');
    const slug = host.split('.')[0]?.toLowerCase();
    if (slug) return slug;
  }
  if (linkedinUrl) {
    const m = linkedinUrl.match(/linkedin\.com\/company\/([^/?#]+)/i);
    const slug = m?.[1]?.toLowerCase();
    if (slug) return slug;
  }
  return null;
}

// ============================================================================
// ORCHESTRATE — un solo disparo que decide la cadena de tools.
// "dame dentistas en Quito que sostengan el ticket" →
//   parse (LLM) → Maps → emails → firma → score → decision-makers.
// ============================================================================

const OR_MODEL = Deno.env.get('ORCHESTRATE_MODEL') ?? 'deepseek/deepseek-v4-flash-0731';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const OPENROUTER_BASE_URL = (Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

/** Parseo de intención → { niche, city, objetivo, tipo }. LLM SOLO hace esto. */
interface Intent {
  niche: string;
  city: string;
  /** 'sostiene' | 'probable' | 'todos' — a qué nivel de facturación apuntar. */
  objetivo: string;
  /** 'local' (negocio físico B2C → Maps) | 'b2b' (empresa → Clay/Apollo). */
  tipo: 'local' | 'b2b';
}

// Keywords que marcan una intención B2B (empresa/servicio profesional) vs un
// negocio local B2C (dentista, taller, restaurante…).
const B2B_KEYWORDS = /software|tecnolog|tech\b|saas|\bit\b|desarrollo|consultor|consulting|agencia|marketing|publicidad|advertising|branding|diseño|fintech|startup|digital|legal|abogad|contab|auditor|ingenier|arquitect|logíst|ecommerce|e-commerce|telecom|seguros|inmobiliar/i;

/** Mapea el niche a buckets de industria válidos de Clay (companies). */
function pickIndustryBuckets(niche: string): string[] {
  const n = niche.toLowerCase();
  const buckets: string[] = [];
  if (/software|tecnolog|tech\b|saas|\bit\b|desarrollo|ingenier|programac|web|app\b|cloud/.test(n)) {
    buckets.push('Software Development', 'IT Services and IT Consulting', 'Technology, Information and Internet');
  }
  if (/consultor|consulting|asesor|estrateg/.test(n)) buckets.push('Business Consulting and Services');
  if (/marketing|publicidad|agencia|advertising|branding|diseño|creativ/.test(n)) {
    buckets.push('Advertising Services', 'Marketing Services');
  }
  if (/fintech|financier|banco|inversi|contab|auditor|seguro/.test(n)) buckets.push('Financial Services');
  if (/legal|abogad|bufete|firma legal/.test(n)) buckets.push('Legal Services');
  if (/salud|med|clinic|hospital|dental|farma/.test(n)) buckets.push('Hospitals and Health Care');
  if (buckets.length === 0) buckets.push('Software Development', 'IT Services and IT Consulting');
  return [...new Set(buckets)];
}

/** Heurística determinística (paridad con src/lib/monidMapping.ts). SIEMPRE
 *  disponible — es el piso mínimo cuando el LLM no está o falla. */
function fallbackIntent(text: string): Intent {
  const cityMatch = text.match(
    /\ben\s+([a-záéíóúñA-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ]*(?:\s+[a-záéíóúñA-ZÁÉÍÓÚÑ]+)*?)(?=\s+que\b|\s+sostien|\s+probable\b|\s+todos\b|\s+y\b|$)/i,
  );
  const city = cityMatch?.[1] ?? '';
  const objetivo: Intent['objetivo'] = /sostien|sosten|sosteng|establecid|factur|plata|grande/i.test(text)
    ? 'sostiene'
    : /probable|quiz|tal vez|medio/i.test(text)
      ? 'probable'
      : 'todos';
  let niche = text;
  if (cityMatch) niche = text.slice(0, cityMatch.index).trim();
  niche = niche.replace(/^(dame|busca|quiero|necesito|encontr|empresas?)\w*\s+de\s+/i, '').replace(/^(dame|busca|quiero|necesito|encontr)\w*\s+/i, '').trim();
  const tipo: Intent['tipo'] = B2B_KEYWORDS.test(text) ? 'b2b' : 'local';
  return { niche: niche || 'negocio', city, objetivo, tipo };
}

async function parseIntent(text: string): Promise<Intent> {
  // Sin LLM → heurística pura.
  if (!OPENROUTER_API_KEY) return fallbackIntent(text);
  try {
    const resp = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: OR_MODEL,
        max_tokens: 120,
        temperature: 0.2,
        reasoning: { enabled: false },
        messages: [
          {
            role: 'system',
            content: 'Extrae de la frase 4 campos para prospección y responde SOLO el JSON: {"niche":"tipo de negocio","city":"ciudad","objetivo":"sostiene|probable|todos","tipo":"local|b2b"}. city es la ciudad o vacía. tipo es "b2b" si es una empresa/servicio profesional (software, consultoría, agencia, tecnología, fintech), "local" si es un negocio físico de barrio (dentista, taller, restaurante). objetivo "sostiene" si pide grandes/establecidos, "probable" si medianos, "todos" si no filtra. niche en español sin artículos ni verbos.',
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`OpenRouter HTTP ${resp.status}`);
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<Intent>;
    const city = String(parsed.city ?? '').trim();
    const objetivo = ['sostiene', 'probable', 'todos'].includes(String(parsed.objetivo)) ? String(parsed.objetivo) as Intent['objetivo'] : 'todos';
    const niche = String(parsed.niche ?? '').trim() || fallbackIntent(text).niche;
    const tipo: Intent['tipo'] = (String(parsed.tipo) === 'b2b' || String(parsed.tipo) === 'local')
      ? String(parsed.tipo) as Intent['tipo']
      : fallbackIntent(text).tipo;
    // Si el LLM no detectó ciudad, reforzar con la heurística (jamás seguir sin ciudad).
    return { niche, city: city || fallbackIntent(text).city, objetivo, tipo };
  } catch {
    // Cualquier fallo del LLM → heurística (mismo resultado que el módulo puro).
    return fallbackIntent(text);
  }
}

/** Replica la lógica de src/lib/facturacion.ts (paridad) + reseñas (señal de
 *  Maps, decisión sep 2026: los negocios locales NO están en PDL, así que las
 *  reseñas de Google son proxy válido de facturación). Score 0-100 o null. */
function scoreFacturacion(s: { empleados?: number; antiguedad?: number; founded?: number; resenas?: number }): number | null {
  const parts: number[] = [];
  if (typeof s.empleados === 'number') {
    const n = s.empleados;
    parts.push(n >= 20 ? 100 : n >= 10 ? 80 : n >= 5 ? 60 : n >= 3 ? 40 : n >= 1 ? 20 : 0);
  }
  const antig = s.antiguedad ?? (s.founded != null ? new Date().getFullYear() - s.founded : undefined);
  if (typeof antig === 'number') {
    parts.push(antig >= 21 ? 80 : antig >= 11 ? 60 : antig >= 3 ? 40 : 15);
  }
  // reseñas de Google Maps (ptsResenas de facturacion.ts): proxy de volumen de negocio.
  if (typeof s.resenas === 'number') {
    const n = s.resenas;
    parts.push(n >= 500 ? 95 : n >= 200 ? 80 : n >= 50 ? 65 : n >= 10 ? 40 : 15);
  }
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function nivelOf(score: number | null): 'sostiene' | 'probable' | 'no' | 'sin-datos' {
  if (score === null) return 'sin-datos';
  if (score >= 70) return 'sostiene';
  if (score >= 40) return 'probable';
  return 'no';
}

interface LeadRow {
  company: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  empleados: unknown;
  founded: unknown;
  antiguedad: unknown;
  size: unknown;
  industry: unknown;
  totalFunding: unknown;
  email: unknown;
  emails: Record<string, unknown>[];
  nivel: 'sostiene' | 'probable' | 'no' | 'sin-datos';
  score: number | null;
  decisionMakers?: Record<string, unknown>[];
}

interface ClayCompany {
  clay_company_id?: number;
  name?: string;
  domain?: string;
  industry?: string;
  size?: string;
  type?: string;
  location?: string;
  country?: string;
  linkedin_url?: string;
  description?: string;
}

/** Descubre empresas B2B con Clay (`select from companies where industry in ...`).
 *  Clay NO filtra bien por ciudad → filtramos por subcadena en location/country
 *  del lado nuestro. Si la ciudad deja todo afuera (cobertura LatAm débil),
 *  devolvemos el top global para no quedar en vacío. */
async function searchCompaniesB2B(niche: string, city: string, limit: number) {
  const buckets = pickIndustryBuckets(niche);
  const inClause = buckets.map((b) => `"${b}"`).join(', ');
  const query = `select from companies where industry in (${inClause})`;

  const create = await monidRun({
    provider: 'clay',
    endpoint: '/search/query-mode',
    input: { body: { query } },
  });
  const searchId = (create.output as { search_id?: string })?.search_id;
  if (!searchId) return { companies: [], all: 0, matched: 0 };

  const page = await monidRun({
    provider: 'clay',
    endpoint: '/search/query-mode/run',
    input: { body: { search_id: searchId, limit: Math.min(limit * 3, 25) } },
  });
  const raw = ((page.output as { data?: ClayCompany[] })?.data ?? []).filter((c) => c.domain && c.name);

  const cityLower = city.toLowerCase().trim();
  const matched = cityLower
    ? raw.filter((c) => {
        const loc = `${c.location ?? ''} ${c.country ?? ''}`.toLowerCase();
        return loc.includes(cityLower);
      })
    : raw;

  // La ciudad es preferencia, no un filtro excluyente: si Clay no tiene cobertura
  // de esa ciudad, devolvemos el top global en vez de nada (y el front lo muestra).
  const companies = matched.length ? matched : raw;
  return { companies: companies.slice(0, limit), all: raw.length, matched: matched.length };
}

/** Corrida completa: intención → lista lista para outreach. */
async function orchestrate(text: string, opts: { maxLeads?: number }) {
  const intent = await parseIntent(text);
  if (!intent.city && intent.tipo === 'local') {
    return { error: 'No detecté una ciudad. Probá: "dame dentistas en Quito que sostengan el ticket".', intent };
  }

  const ORCH_MAX_LEADS = Math.min(opts.maxLeads ?? 8, 8);

  // 1) Descubrimiento según el tipo de intención.
  //    local → Google Maps (negocios B2C). b2b → Clay companies (empresas).
  let discovered: Array<{
    name: string | null;
    website: string | null;
    domain: string | null;
    rating: number | null;
    reviewCount: number | null;
    phone: string | null;
    industry: string | null;
    size: string | null;
  }> = [];

  if (intent.tipo === 'b2b') {
    const r = await searchCompaniesB2B(intent.niche, intent.city, ORCH_MAX_LEADS);
    discovered = r.companies.map((c) => ({
      name: c.name ?? null,
      website: c.domain ? `https://${c.domain}` : null,
      domain: c.domain ?? null,
      rating: null,
      reviewCount: null,
      phone: null,
      industry: c.industry ?? null,
      size: c.size ?? null,
    }));
  } else {
    const maps = await searchMaps(intent.niche, intent.city, ORCH_MAX_LEADS);
    discovered = maps.places.map((p) => ({
      name: p.company,
      website: p.website,
      domain: p.website ? domainOnly(p.website) : null,
      rating: p.rating,
      reviewCount: p.reviewCount,
      phone: p.phone,
      industry: p.type ?? null,
      size: null,
    }));
  }

  // 2) Por cada lead con dominio: firma (PDL) + emails (Hunter), secuencial con
  //    throttle (ver loop abajo) para caber en el wall-clock de la tier gratis
  //    (546) y no disparar el rate limit (429) de Monid.
  const targets = discovered.slice(0, ORCH_MAX_LEADS);

  const enrichOne = async (d: (typeof discovered)[number]): Promise<LeadRow> => {
    const domain = d.domain;
    let senales: Record<string, unknown> = {};
    let emails: Record<string, unknown>[] = [];

    if (domain) {
      try {
        const firm = await enrichFirm(domain);
        senales = (firm.senales as Record<string, unknown>) ?? {};
      } catch { /* firma falla → sigue sin señal */ }
      try {
        const enr = await enrichCompany({ domain });
        emails = (enr.emails as Record<string, unknown>[]) ?? [];
      } catch { /* emails fallan → sigue */ }
    }

    const score = scoreFacturacion({ ...(senales as { empleados?: number; antiguedad?: number; founded?: number }), resenas: d.reviewCount ?? undefined });
    const nivel = nivelOf(score);

    return {
      company: d.name,
      website: d.website,
      phone: d.phone,
      rating: d.rating,
      reviewCount: d.reviewCount,
      empleados: senales.empleados ?? null,
      founded: senales.founded ?? null,
      antiguedad: senales.antiguedad ?? null,
      size: senales.size ?? d.size ?? null,
      industry: senales.industry ?? d.industry ?? null,
      totalFunding: senales.totalFunding ?? null,
      email: emails[0]?.email ?? senales.email ?? null,
      emails,
      nivel,
      score,
    };
  };

  // Secuencial con throttle (NO paralelo): Monid rate-limits (429) cuando el
  // orquestador dispara ~20 runs en ráfaga. Un lead a la vez + delay de 600ms
  // entre leads mantiene la tasa por debajo del límite.
  const leads: LeadRow[] = [];
  for (const t of targets) {
    try { leads.push(await enrichOne(t)); } catch { /* un lead que falla no tumba la corrida */ }
    if (targets.length > 1) await new Promise((r) => setTimeout(r, 600));
  }

  // 3) Decision-makers solo para los TOP 2 que "sostienen" (ahorra balance y
  //    wall-clock — ContactOut es la llamada más cara y lenta del pipeline).
  const sostienen = leads.filter((l) => l.nivel === 'sostiene').slice(0, 2);
  for (const l of sostienen) {
    const ref = l.website ?? l.company;
    try {
      const r = await decisionMakers(String(ref), false); // sin reveal → más barato (solo perfiles)
      const raw = (r.people as { profiles?: Record<string, unknown> })?.profiles ?? {};
      const people = Array.isArray(raw) ? raw : Object.values(raw);
      l.decisionMakers = people.slice(0, 3);
    } catch { l.decisionMakers = []; }
  }

  // 4) Filtrar por objetivo.
  const filtered = intent.objetivo === 'todos'
    ? leads
    : leads.filter((l) => l.nivel === intent.objetivo || (intent.objetivo === 'probable' && l.nivel === 'sostiene'));

  return { intent, total: leads.length, matched: filtered.length, leads: filtered };
}

function domainOnly(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authErr } = await asCaller.auth.getUser();
  if (authErr || !auth?.user) {
    return json({ error: 'No autenticado — vuelve a iniciar sesión' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: caller } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!caller) return json({ error: 'Tu usuario no tiene perfil en el CRM (tabla profiles).' }, 403);
  if (caller.active === false) return json({ error: 'Tu cuenta está inactiva' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  try {
    if (action === 'search') {
      const businessType = String(body.businessType ?? '').trim();
      const location = String(body.location ?? '').trim();
      const limit = Math.min(Math.max(Number(body.limit) || 15, 1), MAX_MAPS_RESULTS);
      if (!businessType || !location) {
        return json({ error: 'Indica tipo de negocio y ubicación' }, 400);
      }
      const result = await searchMaps(businessType, location, limit);
      return json({ places: result.places, cost: result.cost, provider: 'monid' });
    }

    if (action === 'enrich') {
      const linkedinUrl = typeof body.linkedinUrl === 'string' ? body.linkedinUrl : undefined;
      const domain = typeof body.domain === 'string' && body.domain.trim() ? body.domain.trim() : undefined;
      if (!linkedinUrl && !domain) {
        return json({ error: 'Proporciona linkedinUrl o domain' }, 400);
      }
      const signals = await enrichCompany({ linkedinUrl, domain });
      return json({ signals, provider: 'monid' });
    }

    if (action === 'people') {
      const query = typeof body.query === 'string' && body.query.trim() ? body.query.trim() : undefined;
      const personTitles = Array.isArray(body.personTitles)
        ? body.personTitles.filter((x: unknown) => typeof x === 'string').slice(0, 10)
        : [];
      const keywords = typeof body.keywords === 'string' && body.keywords.trim() ? body.keywords.trim() : undefined;
      const companyDomain = typeof body.companyDomain === 'string' ? body.companyDomain : undefined;
      if (!query && !personTitles.length && !keywords) {
        return json({ error: 'Proporciona query (Clay) o personTitles/keywords (Apollo)' }, 400);
      }
      const result = await searchPeople({ query, personTitles, keywords, companyDomain });
      return json({ ...result, provider: 'monid' });
    }

    if (action === 'firma') {
      const website = String(body.website ?? '').trim();
      if (!website) return json({ error: 'Proporciona website' }, 400);
      const result = await enrichFirm(website);
      return json({ ...result, provider: 'monid' });
    }

    if (action === 'decision-makers') {
      const company = String(body.company ?? '').trim();
      if (!company) return json({ error: 'Proporciona company (nombre o dominio)' }, 400);
      const reveal = body.reveal !== false; // por defecto true (incluye emails)
      const result = await decisionMakers(company, reveal);
      return json({ ...result, provider: 'monid' });
    }

    if (action === 'reveal') {
      // Revela emails/phones de los decision-makers de UNA empresa (reveal=true).
      // Cobra ~$0.07 por email encontrado — se usa bajo demanda, no en la corrida.
      const company = String(body.company ?? '').trim();
      if (!company) return json({ error: 'Proporciona company (nombre o dominio)' }, 400);
      const result = await decisionMakers(company, true);
      return json({ ...result, provider: 'monid' });
    }

    if (action === 'balance') {
      requireKey();
      return json(await monidGet('/v1/wallet/balance'));
    }

    if (action === 'orchestrate') {
      const text = String(body.text ?? body.prompt ?? '').trim();
      if (!text) return json({ error: 'Dime qué querés buscar (ej. "dame dentistas en Quito que sostengan el ticket")' }, 400);
      const maxLeads = Math.min(Math.max(Number(body.maxLeads) || 8, 1), 20);
      // Guard de balance: una orquestación completa (Maps + PDL×N + Hunter×N +
      // ContactOut) puede costar $3-5. Avisar temprano si el saldo no alcanza.
      try {
        const bal = await monidGet('/v1/wallet/balance') as { balance?: { value?: number } };
        const valor = bal?.balance?.value ?? 0;
        if (valor < 1) {
          return json({ error: `Saldo Monid insuficiente (${bal?.balance?.value ?? 0}). Recarga en app.monid.ai antes de correr una prospección completa.` }, 402);
        }
      } catch { /* si balance falla, seguir y dejar que Monid rechace si no hay saldo */ }
      const result = await orchestrate(text, { maxLeads });
      if ('error' in result) return json(result, 422);
      return json({ ...result, provider: 'monid' });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});