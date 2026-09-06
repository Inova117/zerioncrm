// ============================================================================
// Supabase Edge Function — analyze-site
// ----------------------------------------------------------------------------
// Analiza las webs de discoveries del Lead Finder y guarda enrichment.technical.
// Se invoca DESDE EL CLIENTE tras una búsqueda done (fire-and-forget); NO
// participa del camino crítico de find-leads/Apify.
//
//   action:'analyze'  { discoveryIds: string[] }  (máx 15 por llamada)
//     → fetch de cada web (concurrencia 5, timeout 10s), parseo de señales
//       HTML, heurística de certificado roto (https falla + http responde),
//       update de lead_discoveries.enrichment (merge technical, service_role).
//     → { analyzed, failed, items: [{ id, technical }] }
//
// Deploy:  supabase functions deploy analyze-site --project-ref kvgrjqszmfiylqwnuhpr
// Verificación: curl -sI -X OPTIONS <url>/functions/v1/analyze-site | grep x-analyze-version
// ============================================================================

const VERSION = '2026-08-16.1';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'x-analyze-version': VERSION,
};

const MAX_IDS = 15;
const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 10_000;

// --- bloque puro: extraído por test-pure.mjs (mantener en paridad) ----------
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

// --- bloque puro de scoring dual: extraído por test-pure.mjs (paridad) ------
// Replica src/lib/prospecting.ts (webScore/agentScore/offerLine) y
// src/lib/nicheCatalog.ts (nicheFor). Si cambian las reglas en un lado y no en
// el otro, el harness de paridad (test-pure.mjs) falla.
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

  // 1) HTTPS primero.
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
      // 2) Heurística: si https falla por TLS, probar http para confirmar que el
      // sitio existe con certificado roto.
      const httpUrl = normalized.replace(/^https:\/\//i, 'http://');
      const t1 = Date.now();
      try {
        const resp2 = await fetchWithTimeout(httpUrl);
        if (resp2.ok) { httpOk = true; status = resp2.status; html = await resp2.text(); }
        loadMs = Math.round(Date.now() - t1);
      } catch {
        /* sin http tampoco: inaccesible */
      }
      if (httpOk) certExpired = true;
    }
    error = `${reason} | ${errMsg.slice(0, 140)}`;
  }

  if (!html && !httpsOk && !httpOk) {
    return {
      ...base,
      accessible: false, https: false, httpOk: false, certExpired,
      httpStatus: status, loadTimeMs: loadMs,
      title: '', hasMetaDescription: false, hasH1: false, hasViewport: false,
      openGraph: false, socials: [], stackHints: [],
      error: error ?? 'sin respuesta',
    };
  }

  const signals = extractHtmlSignals(html);
  return {
    ...base,
    accessible: true,
    https: httpsOk,
    httpOk,
    certExpired,
    httpStatus: status,
    loadTimeMs: loadMs,
    ...signals,
  };
}

// --- handler -----------------------------------------------------------------
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authErr } = await asCaller.auth.getUser();
  if (authErr || !auth?.user) {
    console.error('analyze-site auth failed:', authErr?.message ?? 'no user');
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
  if (body.action !== 'analyze') return json({ error: 'Acción desconocida' }, 400);

  const ids: string[] = Array.isArray(body.discoveryIds)
    ? body.discoveryIds.filter((x: unknown) => typeof x === 'string').slice(0, MAX_IDS)
    : [];
  if (!ids.length) return json({ error: 'discoveryIds requerido (máx 15)' }, 400);

  // Solo las filas del caller (o todas si es admin) — el update usa service_role,
  // así que el ownership se valida AQUÍ, a mano.
  const isAdmin = caller.role === 'admin';
  let q = admin.from('lead_discoveries').select('id, website, enrichment, industry, phone').in('id', ids);
  if (!isAdmin) q = q.eq('assigned_to', caller.id);
  const { data: rows, error: selErr } = q;
  if (selErr) return json({ error: selErr.message }, 500);
  // Carrera del re-run: el cliente puede mandar IDs que el snapshot del front ya
  // no ve (upsert ignoreDuplicates compitió con un poll atrasado). En vez de 404,
  // seguimos con las filas que SÍ matchean; el resto cuenta como failed.
  if (!rows?.length) return json({ analyzed: 0, failed: ids.length, items: [] });

  const targets = rows.filter((r) => String(r.website ?? '').trim());
  const items: Array<{ id: string; technical: Record<string, unknown>; score: number; agentScore: number; offer: string }> = [];
  let failed = 0;

  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const t = targets[i++];
      try {
        const technical = await analyzeSite(String(t.website));
        const enrichment = (t.enrichment ?? {}) as Record<string, unknown>;
        const reviewCount = Number(enrichment.reviewCount ?? 0);
        const rating = enrichment.rating != null ? Number(enrichment.rating) : undefined;
        const score = webScorePure({ website: String(t.website ?? ''), technical, reviewCount });
        const agentScore = agentScorePure({
          nichePrimary: nicheForPure(String(t.industry ?? '')),
          reviewCount,
          rating,
          price: String(enrichment.price ?? ''),
          hasPhone: Boolean(String(t.phone ?? '').trim()),
        });
        items.push({ id: String(t.id), technical, score, agentScore, offer: offerPure(score, agentScore) });
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  // Persistir: merge de technical + scoring dentro del enrichment existente.
  let analyzed = 0;
  for (const it of items) {
    const row = targets.find((t) => String(t.id) === it.id);
    const prev = (row?.enrichment ?? {}) as Record<string, unknown>;
    const { error: upErr } = await admin
      .from('lead_discoveries')
      .update({ enrichment: { ...prev, technical: it.technical, score: it.score, agentScore: it.agentScore, offer: it.offer } })
      .eq('id', it.id);
    if (upErr) failed++;
    else analyzed++;
  }

  return json({ analyzed, failed, items });
});
