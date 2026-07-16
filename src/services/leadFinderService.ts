// ---------------------------------------------------------------------------
// Lead Finder — run the Google-Maps scrape from inside the app.
//
// Dual layer, like every other service:
//   • Supabase → invokes the `find-leads` Edge Function (real Apify scrape).
//   • Mock     → synthesizes plausible local businesses so the flow works
//                offline / in demos.
// Either way the leads land in the leads store as "nuevo" prospectos and the
// caller reloads to see them in the Lead Finder.
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
}

export interface FindLeadsResult {
  found: number;
  inserted: number;
  duplicates: number;
  noWebsite: number;
}

// --- Supabase: invoke the Edge Function ------------------------------------
async function supabaseFindLeads(params: FindLeadsParams): Promise<FindLeadsResult> {
  const { data, error } = await supabase!.functions.invoke('find-leads', {
    body: {
      businessType: params.businessType,
      location: params.location,
      limit: params.limit,
      assignedTo: params.assignedTo,
      language: params.language ?? 'es',
    },
  });
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
  return data as FindLeadsResult;
}

// --- Mock: synthesize plausible Google-Maps results ------------------------
const PREFIXES = ['El', 'La', 'Don', 'Doña', 'Casa', 'Grupo', 'Studio', 'Bella', 'Nueva', 'Central'];
const SUFFIXES = ['Studio', 'Express', 'Center', 'Pro', '& Co', 'Boutique', 'Premium', 'Plaza', 'House', 'VIP'];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const randPhone = () => {
  const n = () => Math.floor(1000 + Math.random() * 9000);
  return `+52 55 ${n()} ${n()}`;
};

async function mockFindLeads(params: FindLeadsParams): Promise<FindLeadsResult> {
  const existing = await leadsService.list();
  const seen = new Set(existing.map((l) => l.company.trim().toLowerCase()));

  const cap = Math.min(Math.max(params.limit, 1), 20);
  let inserted = 0;
  let duplicates = 0;
  let noWebsite = 0;

  for (let i = 0; i < cap; i++) {
    const name = `${pick(PREFIXES)} ${params.businessType} ${pick(SUFFIXES)}`.replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    const hasWebsite = Math.random() > 0.55; // ~45% without a website
    const rating = Math.round((3.8 + Math.random() * 1.2) * 10) / 10;
    const reviewCount = Math.floor(10 + Math.random() * 400);
    const website = hasWebsite ? `${key.replace(/[^a-z0-9]+/g, '')}.com` : '';
    const segment = hasWebsite ? 'has_website' : 'no_website';

    const input: NewLeadInput = {
      company: name,
      contactName: '',
      role: '',
      email: '',
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
        segment,
        profile: `${params.businessType} · ${params.location}`,
      },
    };
    await leadsService.create(input);
    inserted++;
    if (!hasWebsite) noWebsite++;
  }

  await new Promise((r) => setTimeout(r, 700)); // simulate agent latency
  return { found: cap, inserted, duplicates, noWebsite };
}

export const findLeads = supabase ? supabaseFindLeads : mockFindLeads;
