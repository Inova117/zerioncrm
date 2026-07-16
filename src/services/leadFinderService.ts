// ---------------------------------------------------------------------------
// Lead Finder — run the Google-Maps scrape from inside the app.
//
// Dual layer, like every other service:
//   • Supabase → invokes the `find-leads` Edge Function (real Apify scrape).
//   • Mock     → synthesizes plausible local businesses so the flow works
//                offline / in demos.
// The search returns CANDIDATES (not saved). The user picks which ones to save
// (via importLeads), so nothing lands in the CRM until they choose it.
// ---------------------------------------------------------------------------
import { leadsService } from './leadsService';
import type { NewLeadInput } from './leadsService';
import { supabase } from '../lib/supabaseClient';

export interface FindLeadsParams {
  businessType: string;
  location: string;
  limit: number;
  assignedTo: string;
  language?: string;
  /** Also scrape each site for email + social links (slower, costlier). */
  deep?: boolean;
}

/** A found business, shaped for saving as a lead, plus a client-side key. */
export type CandidateLead = NewLeadInput & { tempId: string };

export interface FindLeadsResult {
  found: number;
  duplicates: number;
  noWebsite: number;
  candidates: CandidateLead[];
}

// --- Supabase: async job (start → poll) via the Edge Function --------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase!.functions.invoke('find-leads', { body });
  if (error) {
    // functions.invoke surfaces non-2xx as an error whose context is the
    // Response — dig out the function's JSON { error } for a clear message.
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
    deep: params.deep ?? false,
  });
  const searchId = started.searchId as string | undefined;
  if (!searchId) throw new Error('No se pudo iniciar la búsqueda.');

  // Poll until the scrape finishes (Google Maps can take a couple of minutes).
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
        candidates: (res.candidates as CandidateLead[]) ?? [],
      };
    }
    if (res.status === 'failed') throw new Error(String(res.error ?? 'La búsqueda falló.'));
    wait = Math.min(wait + 500, 5000); // gentle backoff
  }
  throw new Error('La búsqueda tardó demasiado. Intenta con menos resultados.');
}

// --- Mock: synthesize plausible Google-Maps results ------------------------
const PREFIXES = ['El', 'La', 'Don', 'Doña', 'Casa', 'Grupo', 'Studio', 'Bella', 'Nueva', 'Central'];
const SUFFIXES = ['Studio', 'Express', 'Center', 'Pro', '& Co', 'Boutique', 'Premium', 'Plaza', 'House', 'VIP'];
const ZONES = ['Centro', 'Norte', 'Sur', 'Roma', 'Polanco', 'Del Valle', 'Reforma', 'Condesa', 'Providencia', ''];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const randPhone = () => {
  const n = () => Math.floor(1000 + Math.random() * 9000);
  return `+52 55 ${n()} ${n()}`;
};

async function mockFindLeads(params: FindLeadsParams): Promise<FindLeadsResult> {
  const existing = await leadsService.list();
  const seen = new Set(existing.map((l) => l.company.trim().toLowerCase()));

  const cap = Math.min(Math.max(params.limit, 1), 50);
  const candidates: CandidateLead[] = [];
  let duplicates = 0;
  let noWebsite = 0;

  for (let i = 0; i < cap; i++) {
    const name = `${pick(PREFIXES)} ${params.businessType} ${pick(SUFFIXES)} ${pick(ZONES)}`
      .replace(/\s+/g, ' ')
      .trim();
    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    const hasWebsite = Math.random() > 0.55; // ~45% without a website
    const rating = Math.round((3.8 + Math.random() * 1.2) * 10) / 10;
    const reviewCount = Math.floor(10 + Math.random() * 400);
    const slug = key.replace(/[^a-z0-9]+/g, '');
    const website = hasWebsite ? `${slug}.com` : '';
    const segment = hasWebsite ? 'has_website' : 'no_website';
    const address = `Av. ${pick(ZONES) || 'Central'} ${Math.floor(100 + Math.random() * 900)}, ${params.location}`;
    const email = params.deep && hasWebsite ? `hola@${website}` : '';
    const socials = params.deep && hasWebsite ? [`https://instagram.com/${slug}`] : [];
    const tempId = `mock-${slug}-${i}`;

    candidates.push({
      tempId,
      company: name,
      contactName: '',
      role: '',
      email,
      phone: randPhone(),
      website,
      industry: params.businessType,
      source: 'scraper',
      channel: `Lead Finder · ${params.businessType} · ${params.location}`,
      reason: `${params.businessType} · ${params.location} — ⭐ ${rating} (${reviewCount} reseñas) — ${
        hasWebsite ? 'Con sitio web' : 'Sin sitio web (oportunidad alta)'
      }`,
      temperature: 'nuevo',
      service: hasWebsite ? 'otro' : 'web',
      value: 0,
      mrr: 0,
      assignedTo: params.assignedTo,
      lastContactAt: null, // fresh — never contacted
      enrichment: {
        rating,
        reviewCount,
        city: params.location,
        address,
        fullAddress: address,
        googleUrl: `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${params.location}`)}`,
        price: pick(['$', '$$', '$$$']),
        segment,
        placeId: tempId,
        profile: `${params.businessType} · ${params.location}`,
        ...(email ? { email } : {}),
        ...(socials.length ? { socials } : {}),
      },
    });
    if (!hasWebsite) noWebsite++;
  }

  await new Promise((r) => setTimeout(r, 700)); // simulate agent latency
  return { found: cap, duplicates, noWebsite, candidates };
}

export const findLeads = supabase ? supabaseFindLeads : mockFindLeads;
