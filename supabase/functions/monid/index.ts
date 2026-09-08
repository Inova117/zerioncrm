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

const VERSION = '2026-09-05.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MONID_API_KEY = Deno.env.get('MONID_API_KEY') ?? '';

const MONID = 'https://api.monid.ai';
const RUN_TIMEOUT_MS = 60_000;
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

async function monidPost(path: string, body: unknown): Promise<unknown> {
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
  if (!resp.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message
      ?? (data as { message?: string })?.message
      ?? `Monid HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

async function monidGet(path: string): Promise<unknown> {
  const resp = await fetch(`${MONID}${path}`, {
    headers: { Authorization: `Bearer ${MONID_API_KEY}` },
  });
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

/** Parseo de intención → { niche, city, objetivo }. LLM SOLO hace esto. */
interface Intent {
  niche: string;
  city: string;
  /** 'sostiene' | 'probable' | 'todos' — a qué nivel de facturación apuntar. */
  objetivo: string;
}

async function parseIntent(text: string): Promise<Intent> {
  if (!OPENROUTER_API_KEY) {
    // Fallback determinístico sin LLM: heurística simple por palabras clave.
    const cityMatch = text.match(/\ben\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]*(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]*)?)/i);
    const city = cityMatch?.[1] ?? '';
    const objetivo = /sostien|establecid|factur|plata|grande/i.test(text) ? 'sostiene'
      : /probable|quiz|tal vez|medio/i.test(text) ? 'probable'
      : 'todos';
    // niche = el texto antes de "en <ciudad>", sin verbos de relleno.
    let niche = text;
    if (cityMatch) niche = text.slice(0, cityMatch.index).trim();
    niche = niche.replace(/^(dame|busca|quiero|necesito|encontr)\w*\s+/i, '').trim();
    return { niche: niche || 'negocio', city, objetivo };
  }
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
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Extrae de la frase del usuario 3 campos para una búsqueda de prospección B2B. Devuelve SOLO JSON: {"niche": "<tipo de negocio, ej. dentistas>", "city": "<ciudad o vacío>", "objetivo": "<sostiene|probable|todos>"}. objetivo es "sostiene" si pide negocios grandes/establecidos/que facturan, "probable" si quiere candidatos medianos, "todos" si no filtra por tamaño. niche en español, sin artículos ni verbos.',
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`OpenRouter HTTP ${resp.status}`);
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<Intent>;
    return {
      niche: String(parsed.niche ?? 'negocio').trim() || 'negocio',
      city: String(parsed.city ?? '').trim(),
      objetivo: ['sostiene', 'probable', 'todos'].includes(String(parsed.objetivo)) ? String(parsed.objetivo) : 'todos',
    };
  } catch {
    // Si el LLM falla, caer a heurística básica.
    return { niche: text.replace(/^(dame|busca|quiero|necesito)\w*\s+/i, '').trim() || 'negocio', city: '', objetivo: 'todos' };
  }
}

/** Replica la lógica de src/lib/facturacion.ts (paridad). Score 0-100 o null. */
function scoreFacturacion(s: { empleados?: number; antiguedad?: number; founded?: number }): number | null {
  const parts: number[] = [];
  if (typeof s.empleados === 'number') {
    const n = s.empleados;
    parts.push(n >= 20 ? 100 : n >= 10 ? 80 : n >= 5 ? 60 : n >= 3 ? 40 : n >= 1 ? 20 : 0);
  }
  const antig = s.antiguedad ?? (s.founded != null ? new Date().getFullYear() - s.founded : undefined);
  if (typeof antig === 'number') {
    parts.push(antig >= 21 ? 80 : antig >= 11 ? 60 : antig >= 3 ? 40 : 15);
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

/** Corrida completa: intención → lista lista para outreach. */
async function orchestrate(text: string, opts: { maxLeads?: number }) {
  const intent = await parseIntent(text);
  if (!intent.city) {
    return { error: 'No detecté una ciudad. Probá: "dame dentistas en Quito que sostengan el ticket".', intent };
  }

  // 1) Maps
  const maps = await searchMaps(intent.niche, intent.city, Math.min(opts.maxLeads ?? 20, 50));

  // 2) Por cada lugar con web: firma (PDL) + emails (Hunter). Secuencial para no
  //    reventar balance; limitado a maxLeads.
  const leads: Array<{
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
  }> = [];
  for (const place of maps.places.slice(0, opts.maxLeads ?? 20)) {
    const domain = place.website ? domainOnly(place.website) : null;
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

    const score = scoreFacturacion(senales as { empleados?: number; antiguedad?: number; founded?: number });
    const nivel = nivelOf(score);

    leads.push({
      company: place.company,
      website: place.website,
      phone: place.phone,
      rating: place.rating,
      reviewCount: place.reviewCount,
      empleados: senales.empleados ?? null,
      founded: senales.founded ?? null,
      antiguedad: senales.antiguedad ?? null,
      size: senales.size ?? null,
      industry: senales.industry ?? null,
      totalFunding: senales.totalFunding ?? null,
      email: emails[0]?.email ?? senales.email ?? null,
      emails,
      nivel,
      score,
    });
  }

  // 3) Decision-makers solo para los que "sostienen" (ahorra balance).
  const sostienen = leads.filter((l) => l.nivel === 'sostiene');
  for (const l of sostienen) {
    const ref = l.website ?? l.company;
    try {
      const r = await decisionMakers(String(ref), false); // sin reveal → más barato (solo perfiles)
      const people = (r.people as { profiles?: Record<string, unknown>[] })?.profiles ?? [];
      l.decisionMakers = people.slice(0, 5);
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

    if (action === 'balance') {
      requireKey();
      return json(await monidGet('/v1/wallet/balance'));
    }

    if (action === 'orchestrate') {
      const text = String(body.text ?? body.prompt ?? '').trim();
      if (!text) return json({ error: 'Dime qué querés buscar (ej. "dame dentistas en Quito que sostengan el ticket")' }, 400);
      const maxLeads = Math.min(Math.max(Number(body.maxLeads) || 20, 1), 50);
      const result = await orchestrate(text, { maxLeads });
      if ('error' in result) return json(result, 422);
      return json({ ...result, provider: 'monid' });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});