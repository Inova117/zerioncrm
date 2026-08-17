// ============================================================================
// Supabase Edge Function — run-campaign
// ----------------------------------------------------------------------------
// Ejecuta las campañas ACTIVAS de prospección automática (tabla
// prospecting_campaigns). Flujo completo por campaña, SIN usuario:
//
//   Apify (Google Places) → dedupe → analyze web (technical) → scoring dual
//   (webScore + agentScore + offer) → filtro por umbral → insertar leads
//   ganadores asignados al vendedor de la campaña.
//
// Se invoca desde el scheduler (Netlify Scheduled Function) con el header
// `x-cron-secret`. Todo el trabajo interno usa service_role.
//
// Los bloques `analyze-pure` y `scoring-pure` son COPIAS idénticas de los de
// analyze-site/index.ts (paridad verificada por test-pure.mjs). La lógica de
// Apify/normalize replica find-leads; `normalize*` se importa de _shared.
//
// Deploy:  supabase functions deploy run-campaign --project-ref kvgrjqszmfiylqwnuhpr --no-verify-jwt
// Secret:  supabase secrets set CRON_SECRET=<random>
// ============================================================================

const VERSION = '2026-08-16.1';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeDomain, normalizePhone, isSocialUrl } from '../_shared/normalize.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'x-run-campaign-version': VERSION,
};

const FETCH_TIMEOUT_MS = 10_000;

// --- bloque puro de análisis (COPIA de analyze-site, paridad) ---------------
// analyze-pure-begin
const PURE_SOCIAL_HOSTS = new Set([
  'facebook.com', 'instagram.com', 'linkedin.com', 'x.com', 'twitter.com',
  'tiktok.com', 'youtube.com', 'wa.me', 'api.whatsapp.com', 'linktr.ee',
]);

const STACK_SIGNATURES = [
  [/wp-content|wp-includes|wp-json/i, 'wordpress'],
  [/wix\.com|wixstatic\.com/i, 'wix'],
  [/cdn\.shopify\.com|shopify\.com/i, 'shopify'],
  [/squarespace\.com|static1\.squarespace/i, 'squarespace'],
  [/joomla|com_joomla/i, 'joomla'],
  [/__NEXT_DATA__|_next\/static/i, 'next'],
  [/id="root"[\s\S]{0,400}(react|_react)/i, 'react'],
  [/vite|type="module"[^>]*src="\/assets\//i, 'vite'],
];

function isSocialHostPure(url) {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
    return PURE_SOCIAL_HOSTS.has(host) || [...PURE_SOCIAL_HOSTS].some((s) => host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

function extractHtmlSignals(html) {
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim().slice(0, 300);
  const hasMetaDescription =
    /<meta[^>]+name=["']description["']/i.test(html) ||
    /<meta[^>]+property=["']og:description["']/i.test(html);
  const hasH1 = /<h1[\s>]/i.test(html);
  const hasViewport = /name=["']viewport["']/i.test(html);
  const openGraph = /property=["']og:(title|image|url|description)["']/i.test(html);

  const socials = [];
  const hrefRe = /<a[^>]+href=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1];
    if (isSocialHostPure(href)) {
      const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(href) ? href : `https://${href}`)
        .hostname.toLowerCase().replace(/^www\./, '');
      if (!socials.some((s) => s.includes(host))) socials.push(href);
      if (socials.length >= 8) break;
    }
  }

  const stackHints = [];
  for (const [re, label] of STACK_SIGNATURES) {
    if (re.test(html)) stackHints.push(label);
  }
  return { title, hasMetaDescription, hasH1, hasViewport, openGraph, socials, stackHints };
}

/** Clasifica el error de un fetch para la heurística de certificado roto. */
function classifyFetchError(message) {
  const m = (message || '').toLowerCase();
  if (/certificate|tls|ssl|handshake|expired/.test(m)) {
    return { cert: true, reason: 'https falló por certificado/tls' };
  }
  if (/timeout|timed out|abort/i.test(m)) return { cert: false, reason: 'timeout' };
  if (/dns|econnrefused|enotfound|network|failed to resolve/i.test(m)) {
    return { cert: false, reason: 'dns/conexión rechazada' };
  }
  return { cert: false, reason: m.slice(0, 120) || 'error desconocido' };
}
// analyze-pure-end

// --- bloque puro de scoring (COPIA de analyze-site, paridad) ----------------
// scoring-pure-begin
const NICHES_PURE = [
  { primary: 'web', syns: ['contab', 'contador', 'contadores', 'asesor fiscal', 'tributario', 'contabilidad'] },
  { primary: 'web', syns: ['auto', 'autos', 'taller', 'mecanico', 'mecánico', 'mecánica', 'concesionar', 'lavadora de autos', 'lubricentro', 'carrocería'] },
  { primary: 'web', syns: ['abogado', 'abogados', 'bufete', 'estudio juridico', 'estudio jurídico', 'firma legal'] },
  { primary: 'web', syns: ['escuela', 'colegio', 'instituto', 'academia', 'centro educativo', 'guarderia', 'guardería'] },
  { primary: 'web', syns: ['coach', 'coaching', 'mentor', 'consultor'] },
  { primary: 'web', syns: ['psicolog', 'psicólog', 'psiquiatra', 'terapeuta'] },
  { primary: 'aaas', syns: ['clinica', 'clínica', 'centro medico', 'centro médico', 'dental', 'dentista', 'odontolog', 'fisioterapia', 'consultorio'] },
  { primary: 'aaas', syns: ['veterinaria', 'veterinario'] },
  { primary: 'aaas', syns: ['optica', 'óptica', 'lentes', 'oftalmolog'] },
  { primary: 'aaas', syns: ['peluqueria', 'peluquería', 'salon', 'salón', 'barberia', 'barbería', 'spa', 'estetica', 'estética', 'uñas'] },
  { primary: 'aaas', syns: ['gimnasio', 'fitness', 'crossfit', 'entrenamiento', 'personal trainer'] },
  { primary: 'ambigua', syns: ['restaurante', 'restaurantes', 'comida', 'cafeteria', 'cafetería', 'bar', 'pizzeria', 'pizzería', 'cevicheria', 'cevichería'] },
];

function nicheForPure(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return 'ambigua';
  for (const n of NICHES_PURE) {
    if (n.syns.some((s) => q.includes(s))) return n.primary;
  }
  return 'ambigua';
}

function reviewBonusPure(n) {
  if (n >= 100) return 10;
  if (n >= 30) return 5;
  return 0;
}

function webScorePure(input) {
  const t = input.technical || null;
  const hasWeb = Boolean(String(input.website || '').trim());
  const bonus = reviewBonusPure(input.reviewCount || 0);
  if (!hasWeb) return Math.min(100, 95 + bonus);
  if (!t) return 70;
  if (!t.accessible) return 70 + Math.min(17, bonus);
  if (t.certExpired) return 88 + Math.min(6, bonus);
  if (!t.hasViewport) return 80 + Math.min(9, bonus);
  if (!t.hasMetaDescription || !t.hasH1) return 75 + Math.min(10, bonus);
  if (t.loadTimeMs > 3000) return 65 + Math.min(14, bonus);
  if (!t.openGraph && (t.stackHints || []).length === 0) return 55 + Math.min(14, bonus);
  return 20 + Math.min(29, bonus + 14);
}

function agentScorePure(input) {
  const nichePrimary = input.nichePrimary || 'ambigua';
  const reviewCount = input.reviewCount || 0;
  const rating = input.rating;
  const price = input.price || '';
  const hasPhone = Boolean(input.hasPhone);
  let s = 0;
  if (reviewCount >= 100) s += 40;
  else if (reviewCount >= 30) s += 25;
  else if (reviewCount >= 10) s += 10;
  if (rating != null) {
    if (rating >= 4.5) s += 20;
    else if (rating >= 4.0) s += 10;
  }
  if (nichePrimary === 'aaas') s += 20;
  if (price === '$$$') s += 15;
  else if (price === '$$') s += 10;
  if (hasPhone) s += 5;
  if (nichePrimary === 'web') s -= 50;
  return Math.max(0, Math.min(100, s));
}

function offerPure(web, agent) {
  return web >= agent ? 'web' : 'aaas';
}
// scoring-pure-end

// --- análisis de una web -----------------------------------------------------
async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function analyzeSite(rawUrl: string): Promise<Record<string, unknown>> {
  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const base: Record<string, unknown> = { analyzedAt: new Date().toISOString() };

  let httpsOk = false, httpOk = false, certExpired = false, status = 0;
  let loadMs = 0, html = '', error: string | undefined;

  const t0 = Date.now();
  try {
    const resp = await fetchWithTimeout(normalized);
    loadMs = Math.round(Date.now() - t0);
    status = resp.status;
    httpsOk = resp.ok || (resp.status >= 300 && resp.status < 400);
    if (httpsOk) html = await resp.text();
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const { cert, reason } = classifyFetchError(errMsg);
    if (cert) {
      const httpUrl = normalized.replace(/^https:\/\//i, 'http://');
      const t1 = Date.now();
      try {
        const resp2 = await fetchWithTimeout(httpUrl);
        if (resp2.ok) { httpOk = true; status = resp2.status; html = await resp2.text(); }
        loadMs = Math.round(Date.now() - t1);
      } catch { /* inaccesible */ }
      if (httpOk) certExpired = true;
    }
    error = `${reason} | ${errMsg.slice(0, 140)}`;
  }

  if (!html && !httpsOk && !httpOk) {
    return {
      ...base, accessible: false, https: false, httpOk: false, certExpired,
      httpStatus: status, loadTimeMs: loadMs,
      title: '', hasMetaDescription: false, hasH1: false, hasViewport: false,
      openGraph: false, socials: [], stackHints: [], error: error ?? 'sin respuesta',
    };
  }
  const signals = extractHtmlSignals(html);
  return { ...base, accessible: true, https: httpsOk, httpOk, certExpired, httpStatus: status, loadTimeMs: loadMs, ...signals };
}

// --- Apify (replica find-leads) ---------------------------------------------
const ACTOR = 'nwua9Gu5YrADL7ZDj';
const APIFY = 'https://api.apify.com/v2';
const TERMINAL_OK = 'SUCCEEDED';
const TERMINAL_BAD = new Set(['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMING-OUT', 'ABORTING']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apifyStart(input: unknown): Promise<{ runId: string } | { error: string }> {
  const resp = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&timeout=300`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!resp.ok) return { error: `Apify no pudo iniciar (${resp.status})` };
  const j = await resp.json();
  const runId = j?.data?.id;
  return runId ? { runId } : { error: 'Apify no devolvió un run id' };
}

async function apifyRun(runId: string): Promise<{ status: string; datasetId: string | null }> {
  const resp = await fetch(`${APIFY}/actor-runs/${runId}?token=${APIFY_TOKEN}`);
  if (!resp.ok) throw new Error(`Apify status ${resp.status}`);
  const j = await resp.json();
  return { status: j?.data?.status ?? 'UNKNOWN', datasetId: j?.data?.defaultDatasetId ?? null };
}

async function apifyItems(datasetId: string): Promise<Record<string, unknown>[]> {
  const resp = await fetch(`${APIFY}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&format=json`);
  if (!resp.ok) throw new Error(`Apify dataset ${resp.status}`);
  return (await resp.json()) as Record<string, unknown>[];
}

// --- place → campos normalizados (replica readPlace de find-leads) ----------
const SOCIAL_KEYS = ['instagrams', 'facebooks', 'linkedIns', 'twitters', 'youtubes', 'tiktoks', 'pinterests'];

function readPlace(p: Record<string, unknown>) {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) as string[] : []);
  const cats = p.categories;
  const placeId = s(p.placeId) ?? s(p.place_id) ?? s(p.cid);
  const socials: string[] = [];
  for (const k of SOCIAL_KEYS) socials.push(...arr(p[k]));
  const emails = arr(p.emails);
  return {
    placeId,
    title: s(p.title) ?? s(p.name),
    category: s(p.categoryName) ?? (Array.isArray(cats) ? s(cats[0]) : null),
    address: s(p.address) ?? s(p.street),
    city: s(p.city) ?? s(p.neighborhood) ?? s(p.state),
    phone: s(p.phone) ?? s(p.phoneUnformatted),
    website: s(p.website) ?? s(p.webUrl),
    rating: n(p.totalScore) ?? n(p.rating),
    reviews: n(p.reviewsCount) ?? n(p.reviewCount),
    googleUrl: s(p.url) ?? (placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null),
    image: s(p.imageUrl) ?? s(p.imageUrls) ?? null,
    price: s(p.price),
    socials: [...new Set(socials)],
    email: emails[0] ?? null,
  };
}

function segmentOf(website: string | null): string {
  if (normalizeDomain(website)) return 'has_website';
  if (website && isSocialUrl(website)) return 'social_only';
  return 'no_website';
}

// --- ejecución de una campaña ------------------------------------------------
async function runCampaign(admin: ReturnType<typeof createClient>, campaign: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = String(campaign.name || `${campaign.niche} · ${campaign.location}`);
  if (!APIFY_TOKEN) return { name, error: 'APIFY_TOKEN no configurado' };

  const limit = Math.min(Math.max(Number(campaign.limitPerDay) || 30, 1), 50);
  const started = await apifyStart({
    searchStringsArray: [String(campaign.niche)],
    locationQuery: String(campaign.location),
    maxCrawledPlacesPerSearch: limit,
    maxReviews: 0,
    language: 'es',
    skipClosedPlaces: true,
    scrapeContacts: false,
  });
  if ('error' in started) return { name, error: started.error };

  const deadline = Date.now() + 170_000;
  let status = 'RUNNING';
  let datasetId: string | null = null;
  while (Date.now() < deadline) {
    try {
      const r = await apifyRun(started.runId);
      status = r.status;
      datasetId = r.datasetId;
    } catch { /* transient */ }
    if (status === TERMINAL_OK || TERMINAL_BAD.has(status)) break;
    await sleep(4000);
  }
  if (status !== TERMINAL_OK) return { name, error: `Apify terminó en ${status}` };

  const items = datasetId ? await apifyItems(datasetId) : [];
  const parsed = items.map(readPlace).filter((p) => p.placeId && p.title);

  // Dedupe: contra discoveries y leads existentes (placeId + phone).
  const batchPlaceIds = [...new Set(parsed.map((p) => p.placeId as string))];
  const batchPhones = [...new Set(parsed.map((p) => normalizePhone(p.phone)).filter(Boolean) as string[])];
  const inList = (a: string[]): string[] => (a.length ? a : ['__none__']);
  const placeIdCsv = batchPlaceIds.length ? batchPlaceIds.join(',') : '__none__';

  const [discByPlace, leadByPlace, leadByPhone] = await Promise.all([
    admin.from('lead_discoveries').select('place_id').in('place_id', inList(batchPlaceIds)),
    admin.from('leads').select('enrichment').filter('enrichment->>placeId', 'in', `(${placeIdCsv})`),
    admin.from('leads').select('phone').in('phone', inList(batchPhones)),
  ]);

  const seenIds = new Set<string>();
  const seenPhones = new Set<string>();
  for (const r of discByPlace.data ?? []) {
    const pid = (r as { place_id?: string }).place_id;
    if (pid) seenIds.add(pid);
  }
  for (const r of leadByPlace.data ?? []) {
    const pid = (r as { enrichment?: { placeId?: string } }).enrichment?.placeId;
    if (pid) seenIds.add(pid);
  }
  for (const r of leadByPhone.data ?? []) {
    const pk = normalizePhone((r as { phone?: string }).phone);
    if (pk) seenPhones.add(pk);
  }

  const thresholds = (campaign.thresholds ?? { web: 70, aaas: 70 }) as Record<string, number>;
  let found = 0, created = 0, insertedDiscovery = 0;

  for (const pl of parsed) {
    const placeId = pl.placeId as string;
    const pk = normalizePhone(pl.phone);
    if (seenIds.has(placeId) || (pk && seenPhones.has(pk))) continue;
    seenIds.add(placeId);
    if (pk) seenPhones.add(pk);
    found++;

    // Analizar la web (si tiene) y calcular scoring dual.
    let technical: Record<string, unknown> | null = null;
    if (String(pl.website ?? '').trim()) {
      try { technical = await analyzeSite(String(pl.website)); } catch { technical = null; }
    }
    const score = webScorePure({ website: String(pl.website ?? ''), technical, reviewCount: pl.reviews ?? 0 });
    const agent = agentScorePure({
      nichePrimary: nicheForPure(String(pl.category ?? campaign.niche ?? '')),
      reviewCount: pl.reviews ?? 0,
      rating: pl.rating ?? undefined,
      price: pl.price ?? '',
      hasPhone: Boolean(String(pl.phone ?? '').trim()),
    });
    const offer = offerPure(score, agent);

    const segment = segmentOf(pl.website);
    const enrichment: Record<string, unknown> = {
      segment, placeId,
      profile: `${campaign.niche} · ${campaign.location}`,
      ...(technical ? { technical, score, agentScore: agent, offer } : {}),
    };
    if (pl.rating != null) enrichment.rating = pl.rating;
    if (pl.reviews != null) enrichment.reviewCount = pl.reviews;
    if (pl.city) enrichment.city = pl.city;
    if (pl.address) { enrichment.address = pl.address; enrichment.fullAddress = pl.address; }
    if (pl.googleUrl) enrichment.googleUrl = pl.googleUrl;
    if (pl.image) enrichment.image = pl.image;
    if (pl.price) enrichment.price = pl.price;
    if (pl.socials.length) enrichment.socials = pl.socials;
    if (pl.email) enrichment.email = pl.email;

    // Persistir discovery (dedupe por place_id).
    const { error: dErr } = await admin.from('lead_discoveries').upsert(
      {
        place_id: placeId,
        discovered_by: String(campaign.ownerId ?? ''),
        assigned_to: String(campaign.assignedTo ?? ''),
        company: pl.title,
        email: pl.email ?? '', phone: pl.phone ?? '', website: pl.website ?? '',
        industry: pl.category ?? String(campaign.niche),
        channel: `Prospección automática · ${campaign.niche} · ${campaign.location}`,
        reason: `Prospección automática · ${campaign.niche} · ${campaign.location}`,
        service: offer,
        enrichment,
      },
      { onConflict: 'place_id', ignoreDuplicates: true }
    );
    if (!dErr) insertedDiscovery++;

    // Insertar lead si pasa el umbral del servicio ganador.
    const s = offer === 'web' ? score : agent;
    const threshold = thresholds[offer] ?? 70;
    if (s >= threshold) {
      const { error: lErr } = await admin.from('leads').insert({
        company: pl.title,
        contact_name: '', role: '',
        email: pl.email ?? '', phone: pl.phone ?? '', website: pl.website ?? '',
        industry: pl.category ?? String(campaign.niche),
        source: 'scraper',
        channel: `Prospección automática · ${campaign.niche} · ${campaign.location}`,
        reason: `Prospección automática · ${campaign.niche} · ${campaign.location}`,
        script: '',
        temperature: 'nuevo',
        service: offer,
        value: 0, mrr: 0, position: 0,
        assigned_to: String(campaign.assignedTo ?? ''),
        enrichment,
      });
      if (!lErr) created++;
    }
  }

  return { name, found, created, discoveries: insertedDiscovery };
}

// --- handler -----------------------------------------------------------------
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Autenticación por secreto compartido (solo el scheduler).
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'No autorizado' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'run') return json({ error: 'Acción desconocida' }, 400);

  const { data: campaigns, error: cErr } = await admin
    .from('prospecting_campaigns')
    .select('*')
    .eq('active', true);
  if (cErr) return json({ error: cErr.message }, 500);
  if (!campaigns?.length) return json({ ran: 0, results: [] });

  const results = [];
  for (const c of campaigns) {
    try {
      results.push(await runCampaign(admin, c));
    } catch (e) {
      results.push({ name: String(c.name || c.niche), error: String(e) });
    }
  }

  return json({ ran: campaigns.length, results });
});
