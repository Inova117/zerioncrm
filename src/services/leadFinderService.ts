// ---------------------------------------------------------------------------
// Lead Finder — run the Google-Maps scrape from inside the app.
//
// Dual layer, like every other service:
//   • Supabase → invokes the `find-leads` Edge Function (real Apify scrape).
//   • Mock     → synthesizes plausible local businesses so the flow works
//                offline / in demos.
//
// A search returns DISCOVERIES (found businesses, persisted). They are NOT saved
// as leads until the user picks them. Persisting every discovery means:
//   • past runs never repeat a business, and
//   • the "Descubiertos" tab keeps them all (green once saved as a lead).
// ---------------------------------------------------------------------------
import { leadsService } from './leadsService';
import type { NewLeadInput } from './leadsService';
import { supabase } from '../lib/supabaseClient';
import { table, delay } from './db';
import { rowToDiscovery, rowToSearch } from './mappers';
import type { Discovery, SearchSummary, SiteTechnical } from '../types';
import { uid } from '../lib/utils';

export interface FindLeadsParams {
  businessType: string;
  location: string;
  limit: number;
  assignedTo: string;
  language?: string;
  /** Also scrape each site for email + social links. Default ON. */
  deep?: boolean;
}

export interface FindLeadsResult {
  found: number;
  duplicates: number;
  noWebsite: number;
  discoveries: Discovery[];
}

/** Turn a found business into a lead input (for saving). */
export function discoveryToInput(d: Discovery): NewLeadInput {
  return {
    company: d.company,
    contactName: d.contactName,
    role: d.role,
    email: d.email,
    phone: d.phone,
    website: d.website,
    industry: d.industry,
    source: 'scraper',
    channel: d.channel,
    reason: d.reason,
    script: '',
    temperature: 'nuevo',
    service: d.service,
    value: 0,
    mrr: 0,
    assignedTo: d.assignedTo,
    lastContactAt: null,
    enrichment: d.enrichment ?? null,
  };
}

// ===========================================================================
// Supabase
// ===========================================================================
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase!.functions.invoke('find-leads', { body });
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

async function supabaseFindLeads(params: FindLeadsParams): Promise<FindLeadsResult> {
  const started = await invoke({
    action: 'start',
    businessType: params.businessType,
    location: params.location,
    limit: params.limit,
    assignedTo: params.assignedTo,
    language: params.language ?? 'es',
    deep: params.deep ?? true,
  });
  const searchId = started.searchId as string | undefined;
  if (!searchId) throw new Error('No se pudo iniciar la búsqueda.');

  const deadline = Date.now() + 210_000; // ~3.5 min ceiling
  let wait = 2500;
  while (Date.now() < deadline) {
    await sleep(wait);
    const res = await invoke({ action: 'poll', searchId });
    if (res.status === 'done') {
      return {
        found: Number(res.found ?? 0),
        duplicates: Number(res.duplicates ?? 0),
        noWebsite: Number(res.noWebsite ?? 0),
        discoveries: (res.discoveries as Discovery[]) ?? [],
      };
    }
    if (res.status === 'failed') throw new Error(String(res.error ?? 'La búsqueda falló.'));
    wait = Math.min(wait + 500, 5000);
  }
  throw new Error('La búsqueda tardó demasiado. Intenta con menos resultados.');
}

async function supabaseListDiscoveries(): Promise<Discovery[]> {
  const { data, error } = await supabase!
    .from('lead_discoveries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToDiscovery);
}

async function supabaseDeleteDiscovery(id: string): Promise<void> {
  const { error } = await supabase!.from('lead_discoveries').delete().eq('id', id);
  if (error) throw error;
}

async function supabaseListSearches(): Promise<SearchSummary[]> {
  const { data, error } = await supabase!
    .from('lead_searches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map(rowToSearch);
}

// ===========================================================================
// Mock
// ===========================================================================
const PREFIXES = ['El', 'La', 'Don', 'Doña', 'Casa', 'Grupo', 'Studio', 'Bella', 'Nueva', 'Central'];
const SUFFIXES = ['Studio', 'Express', 'Center', 'Pro', '& Co', 'Boutique', 'Premium', 'Plaza', 'House', 'VIP'];
const ZONES = ['Centro', 'Norte', 'Sur', 'Roma', 'Polanco', 'Del Valle', 'Reforma', 'Condesa', 'Providencia', ''];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const randPhone = () => {
  const n = () => Math.floor(1000 + Math.random() * 9000);
  return `+52 55 ${n()} ${n()}`;
};

async function mockFindLeads(params: FindLeadsParams): Promise<FindLeadsResult> {
  const leads = await leadsService.list();
  const existing = table.get('discoveries');
  // Dedupe against BOTH leads and prior discoveries (so past runs don't repeat):
  // by company name AND by placeId — mirroring the Edge Function's placeId dedup.
  const seenNames = new Set([
    ...leads.map((l) => l.company.trim().toLowerCase()),
    ...existing.map((d) => d.company.trim().toLowerCase()),
  ]);
  const seenPlace = new Set([
    ...existing.map((d) => d.placeId),
    ...(leads.map((l) => l.enrichment?.placeId).filter(Boolean) as string[]),
  ]);

  const cap = Math.min(Math.max(params.limit, 1), 50);
  const fresh: Discovery[] = [];
  let duplicates = 0;
  let noWebsite = 0;

  for (let i = 0; i < cap; i++) {
    const name = `${pick(PREFIXES)} ${params.businessType} ${pick(SUFFIXES)} ${pick(ZONES)}`
      .replace(/\s+/g, ' ')
      .trim();
    const key = name.toLowerCase();
    const slug = key.replace(/[^a-z0-9]+/g, '');
    const placeId = `mock-${slug}`;
    if (seenNames.has(key) || seenPlace.has(placeId)) {
      duplicates++;
      continue;
    }
    seenNames.add(key);
    seenPlace.add(placeId);

    const hasWebsite = Math.random() > 0.55;
    const rating = Math.round((3.8 + Math.random() * 1.2) * 10) / 10;
    const reviewCount = Math.floor(10 + Math.random() * 400);
    const website = hasWebsite ? `${slug}.com` : '';
    const segment = hasWebsite ? 'has_website' : 'no_website';
    const address = `Av. ${pick(ZONES) || 'Central'} ${Math.floor(100 + Math.random() * 900)}, ${params.location}`;
    const email = params.deep !== false && hasWebsite ? `hola@${website}` : '';
    const socials = params.deep !== false && hasWebsite ? [`https://instagram.com/${slug}`] : [];
    if (!hasWebsite) noWebsite++;

    fresh.push({
      id: uid('disc-'),
      placeId,
      company: name,
      contactName: '',
      role: '',
      email,
      phone: randPhone(),
      website,
      industry: params.businessType,
      channel: `Lead Finder · ${params.businessType} · ${params.location}`,
      reason: `${params.businessType} · ${params.location} — ⭐ ${rating} (${reviewCount} reseñas) — ${
        hasWebsite ? 'Con sitio web' : 'Sin sitio web (oportunidad alta)'
      }`,
      service: hasWebsite ? 'otro' : 'web',
      assignedTo: params.assignedTo,
      discoveredBy: params.assignedTo,
      createdAt: new Date().toISOString(),
      enrichment: {
        rating,
        reviewCount,
        city: params.location,
        address,
        fullAddress: address,
        googleUrl: `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${params.location}`)}`,
        price: pick(['$', '$$', '$$$']),
        segment,
        placeId,
        profile: `${params.businessType} · ${params.location}`,
        ...(email ? { email } : {}),
        ...(socials.length ? { socials } : {}),
      },
    });
  }

  table.set('discoveries', [...existing, ...fresh]);
  // Historial: cada corrida queda guardada (results = snapshot SIN technical;
  // el informe al reabrir cruza con discoveries actuales para el technical).
  const searches = table.get('searches') as SearchSummary[];
  table.set('searches', [
    ...searches,
    {
      id: uid('search-'),
      businessType: params.businessType,
      location: params.location,
      status: 'done',
      found: fresh.length,
      duplicates,
      noWebsite,
      results: fresh,
      error: null,
      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    },
  ]);
  await sleep(700); // simulate agent latency
  return { found: cap, duplicates, noWebsite, discoveries: fresh };
}

async function mockListDiscoveries(): Promise<Discovery[]> {
  await delay();
  return [...table.get('discoveries')].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function mockDeleteDiscovery(id: string): Promise<void> {
  await delay();
  table.set(
    'discoveries',
    table.get('discoveries').filter((d) => d.id !== id)
  );
}

async function mockListSearches(): Promise<SearchSummary[]> {
  await delay();
  return [...(table.get('searches') as SearchSummary[])].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

// ===========================================================================
// Análisis técnico de webs (edge function analyze-site). Fire-and-forget tras
// una búsqueda done: analiza hasta 15 discoveries con website por llamada.
// ===========================================================================
export interface AnalyzeSitesResult {
  analyzed: number;
  failed: number;
}

async function supabaseAnalyzeSites(discoveryIds: string[]): Promise<AnalyzeSitesResult> {
  const res = await invoke({ action: 'analyze', discoveryIds });
  return { analyzed: Number(res.analyzed ?? 0), failed: Number(res.failed ?? 0) };
}

async function mockAnalyzeSites(discoveryIds: string[]): Promise<AnalyzeSitesResult> {
  const discoveries = table.get('discoveries') as Discovery[];
  const next = discoveries.map((d) => {
    if (!discoveryIds.includes(d.id) || !String(d.website ?? '').trim()) return d;
    // Sintético determinista a partir del slug (estable entre recargas).
    // Hash acumulado con salt: los primeros chars son siempre "mock", un
    // charCodeAt directo por índice colapsa (QA lo detectó: 0% cert roto).
    const slug = d.placeId.replace(/[^a-z0-9]/gi, '');
    const hashAt = (salt: number) => {
      let acc = salt;
      for (const c of slug) acc = (acc * 31 + c.charCodeAt(0)) >>> 0;
      return acc;
    };
    const brokenCert = hashAt(1) % 4 === 0; // ~25%: bueno para QA del badge
    const poorSeo = hashAt(2) % 3 === 0;
    const loadMs = 400 + (hashAt(6) % 12) * 250;
    const technical: SiteTechnical = {
      analyzedAt: new Date().toISOString(),
      accessible: true,
      https: !brokenCert,
      httpOk: brokenCert,
      certExpired: brokenCert,
      httpStatus: 200,
      loadTimeMs: loadMs,
      title: `${d.company} — Inicio`,
      hasMetaDescription: !poorSeo,
      hasH1: hashAt(3) % 2 === 0,
      hasViewport: hashAt(4) % 5 !== 0,
      openGraph: !poorSeo,
      socials: [],
      stackHints: hashAt(5) % 3 === 0 ? ['wordpress'] : ['wix'],
    };
    return { ...d, enrichment: { ...(d.enrichment ?? {}), technical } };
  });
  table.set('discoveries', next);
  await sleep(900); // simular latencia del agente
  return { analyzed: discoveryIds.length, failed: 0 };
}

// ===========================================================================
export const findLeads = supabase ? supabaseFindLeads : mockFindLeads;
export const listDiscoveries = supabase ? supabaseListDiscoveries : mockListDiscoveries;
export const deleteDiscovery = supabase ? supabaseDeleteDiscovery : mockDeleteDiscovery;
export const analyzeSites = supabase ? supabaseAnalyzeSites : mockAnalyzeSites;
export const listSearches = supabase ? supabaseListSearches : mockListSearches;
