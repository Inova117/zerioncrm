// ============================================================================
// Supabase Edge Function — find-leads  (async job model)
// ----------------------------------------------------------------------------
// The in-app "Lead Finder". A Google-Maps scrape can outlast a synchronous
// request, so this runs as a job:
//
//   action:'start'  { businessType, location, limit?, language?, assignedTo? }
//                    → starts an Apify run, records a lead_searches row
//                    → { searchId }
//   action:'poll'   { searchId }
//                    → checks the run; when it finishes, dedupes + inserts the
//                      businesses as "nuevo" prospectos (idempotent), and
//                      returns { status:'running' | 'done' | 'failed', ... }
//
// The browser can't run Apify, so the app calls this function, which holds the
// APIFY_TOKEN server-side. Employees only assign leads to themselves; an admin
// may target any staff via `assignedTo`.
//
// Deploy:  supabase functions deploy find-leads
// Secret:  supabase secrets set APIFY_TOKEN=apify_api_xxx
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? '';

const ACTOR = 'compass~crawler-google-places'; // Google Maps scraper
const MAX_LIMIT = 50;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- normalize (ported from the scraper's lib/normalize) -------------------
const SOCIAL_HOSTS = new Set([
  'facebook.com', 'm.facebook.com', 'instagram.com', 'linktr.ee', 'wa.me',
  'api.whatsapp.com', 'linkedin.com', 'x.com', 'twitter.com', 'tiktok.com',
  'youtube.com', 'yelp.com', 'google.com',
]);
function hostnameOf(url: string): string | null {
  try {
    const s = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(s).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}
function isSocialUrl(url: string): boolean {
  const h = hostnameOf(url);
  if (!h) return false;
  return SOCIAL_HOSTS.has(h) || [...SOCIAL_HOSTS].some((s) => h.endsWith(`.${s}`));
}
function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const h = hostnameOf(url);
  if (!h || isSocialUrl(url)) return null;
  return h;
}
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, '');
  if (d.length < 7) return null;
  if (d.length === 10) return `1${d}`;
  return d;
}

// --- Apify place → normalized fields (defensive against field-name drift) ---
interface RawPlace { [k: string]: unknown }
function readPlace(p: RawPlace) {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
  const cats = p.categories;
  return {
    placeId: s(p.placeId) ?? s(p.place_id) ?? s(p.cid),
    title: s(p.title) ?? s(p.name),
    category: s(p.categoryName) ?? (Array.isArray(cats) ? s(cats[0]) : null),
    address: s(p.address) ?? s(p.street),
    city: s(p.city) ?? s(p.neighborhood) ?? s(p.state),
    phone: s(p.phone) ?? s(p.phoneUnformatted),
    website: s(p.website) ?? s(p.webUrl),
    rating: n(p.totalScore) ?? n(p.rating),
    reviews: n(p.reviewsCount) ?? n(p.reviewCount),
  };
}

function segmentOf(website: string | null): string {
  if (normalizeDomain(website)) return 'has_website';
  if (website && isSocialUrl(website)) return 'social_only';
  return 'no_website';
}
function buildReason(pl: ReturnType<typeof readPlace>, segment: string): string {
  const seg: Record<string, string> = {
    no_website: 'Sin sitio web (oportunidad alta)',
    social_only: 'Solo redes sociales',
    has_website: 'Con sitio web',
  };
  const head = [pl.category, pl.city].filter(Boolean).join(' · ');
  const rating = pl.rating != null ? `⭐ ${pl.rating}${pl.reviews != null ? ` (${pl.reviews} reseñas)` : ''}` : '';
  return [head, rating, seg[segment] ?? ''].filter(Boolean).join(' — ');
}

// --- Apify REST ------------------------------------------------------------
const APIFY = 'https://api.apify.com/v2';

async function apifyStart(input: unknown): Promise<{ runId: string } | { error: string }> {
  const resp = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&timeout=300`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
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

async function apifyItems(datasetId: string): Promise<RawPlace[]> {
  const resp = await fetch(`${APIFY}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&format=json`);
  if (!resp.ok) throw new Error(`Apify dataset ${resp.status}`);
  return (await resp.json()) as RawPlace[];
}

const TERMINAL_OK = 'SUCCEEDED';
const TERMINAL_BAD = new Set(['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMING-OUT', 'ABORTING']);

interface SearchRow {
  id: string;
  apify_run_id: string | null;
  requested_by: string;
  assigned_to: string;
  business_type: string;
  location: string;
  status: string;
  error: string | null;
  found: number;
  inserted: number;
  duplicates: number;
  no_website: number;
}

function summaryOf(s: SearchRow) {
  return {
    status: s.status,
    found: s.found,
    inserted: s.inserted,
    duplicates: s.duplicates,
    noWebsite: s.no_website,
    error: s.error,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Authenticated, active caller.
  const authHeader = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authErr } = await asCaller.auth.getUser();
  if (authErr || !auth?.user) {
    console.error('find-leads auth failed:', authErr?.message ?? 'no user');
    return json({ error: 'No autenticado — vuelve a iniciar sesión' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  // Read the caller's profile with their OWN session (RLS lets any authenticated
  // user read profiles). service_role is used only for the writes below.
  const { data: caller, error: profErr } = await asCaller
    .from('profiles')
    .select('id, role, active')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profErr) {
    console.error('find-leads profile lookup error:', profErr.message);
    return json({ error: `No se pudo leer tu perfil: ${profErr.message}` }, 403);
  }
  if (!caller) {
    console.error('find-leads: no profile row for user', auth.user.id);
    return json({ error: 'Tu usuario no tiene perfil en el CRM (tabla profiles).' }, 403);
  }
  if (caller.active === false) return json({ error: 'Tu cuenta está inactiva' }, 403);

  if (!APIFY_TOKEN) return json({ error: 'APIFY_TOKEN no configurado en la Edge Function' }, 500);

  const body = await req.json().catch(() => ({}));
  const action = body.action ?? 'start';

  // ------------------------------------------------------------------ START
  if (action === 'start') {
    const businessType = String(body.businessType ?? '').trim();
    const location = String(body.location ?? '').trim();
    const language = (String(body.language ?? 'es').trim() || 'es').slice(0, 5);
    const limit = Math.min(Math.max(Number(body.limit) || 15, 1), MAX_LIMIT);
    if (!businessType || !location) return json({ error: 'Indica tipo de negocio y ubicación' }, 400);

    let assignedTo = caller.id as string;
    if (caller.role === 'admin' && body.assignedTo) {
      const { data: target } = await admin.from('profiles').select('id').eq('id', body.assignedTo).maybeSingle();
      if (target) assignedTo = target.id as string;
    }

    const input = {
      searchStringsArray: [businessType],
      locationQuery: location,
      maxCrawledPlacesPerSearch: limit,
      maxReviews: 0,
      language,
      skipClosedPlaces: true,
      scrapeContacts: false,
    };
    const started = await apifyStart(input);
    if ('error' in started) return json({ error: started.error }, 502);

    const { data: row, error } = await admin
      .from('lead_searches')
      .insert({
        apify_run_id: started.runId,
        requested_by: caller.id,
        assigned_to: assignedTo,
        business_type: businessType,
        location,
        status: 'running',
      })
      .select('id')
      .single();
    if (error || !row) return json({ error: `No se pudo crear la búsqueda: ${error?.message}` }, 500);
    return json({ searchId: row.id });
  }

  // ------------------------------------------------------------------- POLL
  if (action === 'poll') {
    const searchId = String(body.searchId ?? '');
    if (!searchId) return json({ error: 'searchId requerido' }, 400);

    const { data: search } = await admin.from('lead_searches').select('*').eq('id', searchId).single();
    if (!search) return json({ error: 'Búsqueda no encontrada' }, 404);
    const s = search as SearchRow;
    if (s.requested_by !== caller.id && caller.role !== 'admin') return json({ error: 'No autorizado' }, 403);

    if (s.status === 'done' || s.status === 'failed') return json(summaryOf(s));
    if (s.status === 'ingesting') return json({ status: 'running' });
    if (!s.apify_run_id) return json({ status: 'running' });

    // Check the Apify run.
    let run: { status: string; datasetId: string | null };
    try {
      run = await apifyRun(s.apify_run_id);
    } catch {
      return json({ status: 'running' }); // transient — keep polling
    }

    if (TERMINAL_BAD.has(run.status)) {
      await admin.from('lead_searches')
        .update({ status: 'failed', error: `El scrape terminó en ${run.status}`, finished_at: new Date().toISOString() })
        .eq('id', searchId);
      return json({ status: 'failed', error: `El scrape terminó en ${run.status}` });
    }
    if (run.status !== TERMINAL_OK) return json({ status: 'running' });

    // SUCCEEDED — claim the ingest so concurrent polls can't double-insert.
    const { data: claimed } = await admin
      .from('lead_searches')
      .update({ status: 'ingesting' })
      .eq('id', searchId)
      .eq('status', 'running')
      .select('id')
      .maybeSingle();
    if (!claimed) {
      const { data: cur } = await admin.from('lead_searches').select('*').eq('id', searchId).single();
      const c = cur as SearchRow;
      return json(c.status === 'done' || c.status === 'failed' ? summaryOf(c) : { status: 'running' });
    }

    try {
      const items = run.datasetId ? await apifyItems(run.datasetId) : [];

      // Dedupe against existing leads (placeId + normalized phone).
      const { data: existing } = await admin.from('leads').select('phone, enrichment');
      const seenIds = new Set<string>();
      const seenPhones = new Set<string>();
      for (const r of existing ?? []) {
        const pid = (r as { enrichment?: { placeId?: string } }).enrichment?.placeId;
        if (pid) seenIds.add(pid);
        const pk = normalizePhone((r as { phone?: string }).phone);
        if (pk) seenPhones.add(pk);
      }

      const { data: maxRow } = await admin
        .from('leads').select('position')
        .eq('assigned_to', s.assigned_to).eq('temperature', 'nuevo')
        .order('position', { ascending: false }).limit(1).maybeSingle();
      let position = ((maxRow as { position?: number } | null)?.position ?? -1) + 1;

      const rows: Record<string, unknown>[] = [];
      let duplicates = 0;
      for (const raw of items) {
        const pl = readPlace(raw);
        if (!pl.placeId || !pl.title) continue;
        const pk = normalizePhone(pl.phone);
        if (seenIds.has(pl.placeId) || (pk && seenPhones.has(pk))) { duplicates++; continue; }
        seenIds.add(pl.placeId);
        if (pk) seenPhones.add(pk);

        const segment = segmentOf(pl.website);
        const hasWebsite = segment === 'has_website';
        const enrichment: Record<string, unknown> = {
          segment, placeId: pl.placeId, searchId,
          profile: `${s.business_type} · ${s.location}`,
        };
        if (pl.rating != null) enrichment.rating = pl.rating;
        if (pl.reviews != null) enrichment.reviewCount = pl.reviews;
        if (pl.city) enrichment.city = pl.city;
        if (pl.address) enrichment.address = pl.address;

        rows.push({
          company: pl.title,
          contact_name: '', role: '', email: '',
          phone: pl.phone ?? '',
          website: pl.website ?? '',
          industry: pl.category ?? s.business_type,
          source: 'scraper',
          channel: `Lead Finder · ${s.business_type} · ${s.location}`,
          reason: buildReason(pl, segment),
          temperature: 'nuevo',
          service: hasWebsite ? 'otro' : 'web',
          value: 0, mrr: 0,
          position: position++,
          assigned_to: s.assigned_to,
          enrichment,
        });
      }

      if (rows.length) {
        const { error: insErr } = await admin.from('leads').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      const noWebsite = rows.filter((r) => !String(r.website ?? '').trim()).length;
      await admin.from('lead_searches').update({
        status: 'done', found: items.length, inserted: rows.length,
        duplicates, no_website: noWebsite, finished_at: new Date().toISOString(),
      }).eq('id', searchId);

      return json({ status: 'done', found: items.length, inserted: rows.length, duplicates, noWebsite });
    } catch (e) {
      await admin.from('lead_searches')
        .update({ status: 'failed', error: String(e), finished_at: new Date().toISOString() })
        .eq('id', searchId);
      return json({ status: 'failed', error: String(e) });
    }
  }

  return json({ error: `Acción desconocida: ${action}` }, 400);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
