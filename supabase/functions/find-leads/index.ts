// ============================================================================
// Supabase Edge Function — find-leads
// ----------------------------------------------------------------------------
// The in-app "Lead Finder": runs the Google-Maps scrape live (Apify) and drops
// the businesses into the CRM as prospectos "nuevo", flagging the ones without
// a website (the hottest leads for a web-dev agency). This is the server side
// of the ScraperAI integration — the browser can't run Apify, so the app calls
// this function, which runs the scrape with a server-held APIFY_TOKEN.
//
//   body: { businessType, location, limit?, language?, assignedTo? }
//   → { found, inserted, duplicates, noWebsite }
//
// Auth: any active CRM user may search. Employees can only assign leads to
// themselves; an admin may target any staff member via `assignedTo`.
//
// Deploy:  supabase functions deploy find-leads
// Secret:  supabase secrets set APIFY_TOKEN=apify_api_xxx
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? '';

// Google Maps scraper (same actor the CLI pipeline uses).
const ACTOR = 'compass~crawler-google-places';
const MAX_LIMIT = 20; // keep run-sync within the Edge Function time budget

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- normalize helpers (ported from the scraper's lib/normalize) -----------
const SOCIAL_HOSTS = new Set([
  'facebook.com', 'm.facebook.com', 'instagram.com', 'linktr.ee', 'wa.me',
  'api.whatsapp.com', 'linkedin.com', 'x.com', 'twitter.com', 'tiktok.com',
  'youtube.com', 'yelp.com', 'google.com',
]);

function hostnameOf(url: string): string | null {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}
function isSocialUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return SOCIAL_HOSTS.has(host) || [...SOCIAL_HOSTS].some((s) => host.endsWith(`.${s}`));
}
function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = hostnameOf(url);
  if (!host || isSocialUrl(url)) return null;
  return host;
}
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

interface ApifyPlace {
  placeId?: string;
  title?: string;
  categoryName?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
}

function segmentOf(website: string | null | undefined): string {
  if (normalizeDomain(website)) return 'has_website';
  if (website && isSocialUrl(website)) return 'social_only';
  return 'no_website';
}

function buildReason(p: ApifyPlace, segment: string): string {
  const segLabel: Record<string, string> = {
    no_website: 'Sin sitio web (oportunidad alta)',
    social_only: 'Solo redes sociales',
    has_website: 'Con sitio web',
  };
  const head = [p.categoryName, p.city].filter(Boolean).join(' · ');
  const rating = p.totalScore != null
    ? `⭐ ${p.totalScore}${p.reviewsCount != null ? ` (${p.reviewsCount} reseñas)` : ''}`
    : '';
  return [head, rating, segLabel[segment] ?? ''].filter(Boolean).join(' — ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1) Authenticated, active caller.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: me } = await asCaller.auth.getUser();
  if (!me?.user) return json({ error: 'No autenticado' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: caller } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', me.user.id)
    .single();
  if (!caller || caller.active === false) return json({ error: 'Cuenta inactiva' }, 403);

  if (!APIFY_TOKEN) {
    return json({ error: 'APIFY_TOKEN no configurado en la Edge Function' }, 500);
  }

  // 2) Validate input.
  const body = await req.json().catch(() => ({}));
  const businessType = String(body.businessType ?? '').trim();
  const location = String(body.location ?? '').trim();
  const language = String(body.language ?? 'es').trim() || 'es';
  const limit = Math.min(Math.max(Number(body.limit) || 15, 1), MAX_LIMIT);
  if (!businessType || !location) {
    return json({ error: 'Indica tipo de negocio y ubicación' }, 400);
  }

  // Assignee: employees → themselves; admin → any existing profile (default self).
  let assignedTo = caller.id as string;
  if (caller.role === 'admin' && body.assignedTo) {
    const { data: target } = await admin
      .from('profiles')
      .select('id')
      .eq('id', body.assignedTo)
      .maybeSingle();
    if (target) assignedTo = target.id as string;
  }

  // 3) Run the Google-Maps scrape synchronously.
  const input = {
    searchStringsArray: [`${businessType} in ${location}`],
    maxCrawledPlacesPerSearch: limit,
    maxReviews: 0,
    language,
    skipClosedPlaces: true,
    scrapeContacts: false,
  };

  let items: ApifyPlace[] = [];
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=110`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    );
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return json({ error: `Apify respondió ${resp.status}`, detail: detail.slice(0, 300) }, 502);
    }
    items = (await resp.json()) as ApifyPlace[];
  } catch (e) {
    return json({ error: `No se pudo ejecutar el scrape: ${String(e)}` }, 502);
  }

  // 4) Dedupe against existing leads (placeId + normalized phone).
  const { data: existing } = await admin.from('leads').select('phone, enrichment');
  const seenPlaceIds = new Set<string>();
  const seenPhones = new Set<string>();
  for (const row of existing ?? []) {
    const pid = (row as { enrichment?: { placeId?: string } }).enrichment?.placeId;
    if (pid) seenPlaceIds.add(pid);
    const pk = normalizePhone((row as { phone?: string }).phone);
    if (pk) seenPhones.add(pk);
  }

  const { data: maxRow } = await admin
    .from('leads')
    .select('position')
    .eq('assigned_to', assignedTo)
    .eq('temperature', 'nuevo')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  let position = ((maxRow as { position?: number } | null)?.position ?? -1) + 1;

  // 5) Map → CRM rows.
  const rows: Record<string, unknown>[] = [];
  let duplicates = 0;
  for (const p of items) {
    if (!p.placeId || !p.title) continue;
    const phoneKey = normalizePhone(p.phone);
    if (seenPlaceIds.has(p.placeId) || (phoneKey && seenPhones.has(phoneKey))) {
      duplicates++;
      continue;
    }
    seenPlaceIds.add(p.placeId);
    if (phoneKey) seenPhones.add(phoneKey);

    const segment = segmentOf(p.website);
    const hasWebsite = segment === 'has_website';
    const enrichment: Record<string, unknown> = { segment, placeId: p.placeId, profile: `${businessType} · ${location}` };
    if (p.totalScore != null) enrichment.rating = p.totalScore;
    if (p.reviewsCount != null) enrichment.reviewCount = p.reviewsCount;
    if (p.city) enrichment.city = p.city;
    if (p.address) enrichment.address = p.address;

    rows.push({
      company: p.title,
      contact_name: '',
      role: '',
      email: '',
      phone: p.phone ?? '',
      website: p.website ?? '',
      industry: p.categoryName ?? businessType,
      source: 'scraper',
      channel: `Lead Finder · ${businessType} · ${location}`,
      reason: buildReason(p, segment),
      temperature: 'nuevo',
      service: hasWebsite ? 'otro' : 'web',
      value: 0,
      mrr: 0,
      position: position++,
      assigned_to: assignedTo,
      enrichment,
    });
  }

  if (rows.length) {
    const { error } = await admin.from('leads').insert(rows);
    if (error) return json({ error: `No se pudieron guardar los leads: ${error.message}` }, 500);
  }

  return json({
    found: items.length,
    inserted: rows.length,
    duplicates,
    noWebsite: rows.filter((r) => !String(r.website ?? '').trim()).length,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
