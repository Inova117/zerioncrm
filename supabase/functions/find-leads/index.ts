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
import { isSocialUrl, normalizeDomain, normalizePhone } from '../_shared/normalize.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? '';

// Google Maps scraper (compass/crawler-google-places). Pinned by actor ID so a
// rename of the public actor can't break us. Slug form: compass~crawler-google-places.
const ACTOR = 'nwua9Gu5YrADL7ZDj';
const MAX_LIMIT = 50;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- normalize: shared module (supabase/functions/_shared/normalize.ts) ----
// Canonical copy kept in parity with ZerionScraperAI/src/lib/normalize.ts by
// test/normalize-parity.test.ts — change both together or the test fails.

// --- Apify place → normalized fields (defensive against field-name drift) ---
interface RawPlace { [k: string]: unknown }
// Social-profile arrays the actor returns with scrapeContacts=true.
const SOCIAL_KEYS = ['instagrams', 'facebooks', 'linkedIns', 'twitters', 'youtubes', 'tiktoks', 'pinterests'];

function readPlace(p: RawPlace) {
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
    // Rich fields for the lead detail:
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
  results: unknown[] | null;
}

function summaryOf(s: SearchRow) {
  return {
    status: s.status,
    found: s.found,
    duplicates: s.duplicates,
    noWebsite: s.no_website,
    discoveries: s.results ?? [],
    error: s.error,
  };
}

// snake_case lead_discoveries row → camelCase Discovery for the client.
function discoveryFromRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    placeId: r.place_id,
    company: r.company,
    contactName: r.contact_name ?? '',
    role: r.role ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    website: r.website ?? '',
    industry: r.industry ?? '',
    channel: r.channel ?? '',
    reason: r.reason ?? '',
    service: r.service ?? 'otro',
    assignedTo: r.assigned_to,
    discoveredBy: r.discovered_by,
    createdAt: r.created_at,
    enrichment: r.enrichment ?? null,
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

    // Deep mode also scrapes each business's website for email + social links
    // (slower + costlier). ON by default; pass deep:false to skip it.
    const deep = body.deep !== false;
    const input = {
      searchStringsArray: [businessType],
      locationQuery: location,
      maxCrawledPlacesPerSearch: limit,
      maxReviews: 0,
      language,
      skipClosedPlaces: true,
      scrapeContacts: deep,
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

    // SUCCEEDED. Ingest is idempotent (place_id is UNIQUE + ON CONFLICT DO
    // NOTHING) and finalized with a CONDITIONAL update, so there is no
    // 'ingesting' lock to get wedged by a crash, and a concurrent poll can't
    // corrupt the row.
    try {
      const items = run.datasetId ? await apifyItems(run.datasetId) : [];
      const parsed = items.map(readPlace).filter((p) => p.placeId && p.title);

      // Batch-scoped dedup: fetch ONLY rows matching this run's businesses, so
      // the queries never hit PostgREST's max-rows (1000) cap as tables grow.
      const batchPlaceIds = [...new Set(parsed.map((p) => p.placeId as string))];
      const batchPhones = [...new Set(parsed.map((p) => p.phone).filter(Boolean) as string[])];
      const inList = (a: string[]): string[] => (a.length ? a : ['__none__']);
      const placeIdCsv = batchPlaceIds.length ? batchPlaceIds.join(',') : '__none__';

      const [discByPlace, discByPhone, leadByPhone, leadByPlace] = await Promise.all([
        admin.from('lead_discoveries').select('place_id').in('place_id', inList(batchPlaceIds)),
        admin.from('lead_discoveries').select('phone').in('phone', inList(batchPhones)),
        admin.from('leads').select('phone').in('phone', inList(batchPhones)),
        admin.from('leads').select('enrichment').filter('enrichment->>placeId', 'in', `(${placeIdCsv})`),
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
      for (const r of [...(discByPhone.data ?? []), ...(leadByPhone.data ?? [])]) {
        const pk = normalizePhone((r as { phone?: string }).phone);
        if (pk) seenPhones.add(pk);
      }

      // Build discovery rows for the NEW businesses only.
      const rows: Record<string, unknown>[] = [];
      let duplicates = 0;
      for (const pl of parsed) {
        const placeId = pl.placeId as string;
        const pk = normalizePhone(pl.phone);
        if (seenIds.has(placeId) || (pk && seenPhones.has(pk))) { duplicates++; continue; }
        seenIds.add(placeId);
        if (pk) seenPhones.add(pk);

        const segment = segmentOf(pl.website);
        const hasWebsite = segment === 'has_website';
        const enrichment: Record<string, unknown> = {
          segment, placeId,
          profile: `${s.business_type} · ${s.location}`,
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

        rows.push({
          place_id: placeId,
          discovered_by: s.requested_by,
          assigned_to: s.assigned_to,
          company: pl.title,
          contact_name: '', role: '',
          email: pl.email ?? '',
          phone: pl.phone ?? '',
          website: pl.website ?? '',
          industry: pl.category ?? s.business_type,
          channel: `Lead Finder · ${s.business_type} · ${s.location}`,
          reason: buildReason(pl, segment),
          service: hasWebsite ? 'otro' : 'web',
          enrichment,
        });
      }

      let discoveries: ReturnType<typeof discoveryFromRow>[] = [];
      if (rows.length) {
        const { data: inserted, error: insErr } = await admin
          .from('lead_discoveries')
          .upsert(rows, { onConflict: 'place_id', ignoreDuplicates: true })
          .select();
        if (insErr) throw new Error(insErr.message);
        discoveries = (inserted ?? []).map((r: Record<string, unknown>) => discoveryFromRow(r));
      }
      // Rows the UNIQUE index dropped (a concurrent run beat us to them) are dups.
      duplicates += rows.length - discoveries.length;

      const noWebsite = discoveries.filter((d) => !String(d.website ?? '').trim()).length;

      // Finalize once. Only the first poll to flip status → done writes results;
      // matching 'ingesting' too recovers any row wedged by an older deploy.
      const { data: won } = await admin.from('lead_searches')
        .update({
          status: 'done', found: items.length, inserted: 0,
          duplicates, no_website: noWebsite, results: discoveries,
          finished_at: new Date().toISOString(),
        })
        .eq('id', searchId)
        .in('status', ['running', 'ingesting'])
        .select('id')
        .maybeSingle();
      if (!won) {
        const { data: cur } = await admin.from('lead_searches').select('*').eq('id', searchId).single();
        return json(summaryOf(cur as SearchRow));
      }
      return json({ status: 'done', found: items.length, duplicates, noWebsite, discoveries });
    } catch (e) {
      await admin.from('lead_searches')
        .update({ status: 'failed', error: String(e), finished_at: new Date().toISOString() })
        .eq('id', searchId)
        .in('status', ['running', 'ingesting']);
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
