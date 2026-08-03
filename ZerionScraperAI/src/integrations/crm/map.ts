// ---------------------------------------------------------------------------
// Scraper lead → Zerion CRM prospecto (public.leads row).
//
// Pure, side-effect-free mapping so it can be unit-tested against fixtures.
// The CRM stores one prospect per company; the phone is the asset René needs
// for cold calling, and `reason` is the "why this is a lead" call context.
// ---------------------------------------------------------------------------
import type { Lead, Profile } from '../../pipeline/types.js';
import { normalizePhone } from '../../lib/normalize.js';

/** A row ready to insert into the CRM's public.leads table (snake_case). */
export interface CrmLeadRow {
  company: string;
  contact_name: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  source: 'scraper';
  channel: string;
  reason: string;
  temperature: 'nuevo';
  service: string;
  value: number;
  mrr: number;
  position: number;
  assigned_to: string;
  /** Structured Google-Maps extras → CRM `enrichment` jsonb (Lead Finder cards). */
  enrichment: Record<string, unknown>;
}

/**
 * Structured extras the CRM's Lead Finder renders (rating, city, segment…).
 * Built key-by-key so we never write `undefined` into the jsonb column.
 */
function buildEnrichment(lead: Lead, profile: Profile): Record<string, unknown> {
  const e: Record<string, unknown> = {
    segment: lead.segment,
    runId: lead.firstRunId,
    profile: profile.name,
  };
  if (lead.googleRating != null) e.rating = lead.googleRating;
  if (lead.reviewCount != null) e.reviewCount = lead.reviewCount;
  if (lead.city) e.city = lead.city;
  if (lead.whatTheyDo) e.whatTheyDo = lead.whatTheyDo;
  if (lead.score != null) e.score = lead.score;
  if (lead.whatsappPhone) e.whatsapp = lead.whatsappPhone;
  if (lead.address) e.address = lead.address;
  return e;
}

/**
 * Segment → CRM service line + a human label for the call context.
 * A business with no/broken/social-only web presence is a `web` opportunity;
 * everything else defaults to `otro` (René refines it in the CRM).
 */
const SEGMENT_INFO: Record<string, { service: string; label: string }> = {
  no_website: { service: 'web', label: 'Sin sitio web (oportunidad alta)' },
  social_only: { service: 'web', label: 'Solo redes sociales' },
  parked: { service: 'web', label: 'Sitio caído / parqueado' },
  has_website: { service: 'otro', label: 'Con sitio web' },
  unknown: { service: 'otro', label: '' },
};

const segmentInfo = (segment: string) => SEGMENT_INFO[segment] ?? SEGMENT_INFO.unknown!;

/**
 * The best phone key for cross-CRM dedupe. Prefers the already-normalized
 * column; falls back to normalizing the raw phone / whatsapp on the fly.
 */
export function crmPhoneKey(lead: Lead): string | null {
  return lead.normalizedPhone ?? normalizePhone(lead.phone) ?? normalizePhone(lead.whatsappPhone);
}

/** Rich, cold-call-ready context packed into the CRM `reason` field. */
export function buildReason(lead: Lead): string {
  const info = segmentInfo(lead.segment);

  const headline: string[] = [];
  const where = [lead.category, lead.city].filter(Boolean).join(' · ');
  if (where) headline.push(where);
  if (lead.googleRating != null) {
    const reviews = lead.reviewCount != null ? ` (${lead.reviewCount} reseñas)` : '';
    headline.push(`⭐ ${lead.googleRating}${reviews}`);
  }
  if (info.label) headline.push(info.label);

  const extra: string[] = [];
  if (lead.whatTheyDo) extra.push(`Qué hacen: ${lead.whatTheyDo}`);
  if (lead.score != null) {
    const top = lead.scoreReasons?.[0]?.reason;
    extra.push(`Score ${lead.score}${top ? ` · ${top}` : ''}`);
  }
  if (lead.whatsappPhone && lead.whatsappPhone !== lead.phone) {
    extra.push(`WhatsApp: ${lead.whatsappPhone}`);
  }
  if (lead.address) extra.push(lead.address);

  const top = headline.join(' — ');
  const bottom = extra.join(' · ');
  return [top, bottom].filter(Boolean).join('\n');
}

/** Map one enriched scraper lead into a CRM prospecto row. */
export function leadToCrmRow(
  lead: Lead,
  profile: Profile,
  opts: { assignedTo: string; position: number },
): CrmLeadRow {
  const info = segmentInfo(lead.segment);
  return {
    company: lead.name,
    contact_name: lead.decisionMakerName ?? '',
    role: '',
    email: '',
    phone: lead.phone ?? lead.whatsappPhone ?? '',
    website: lead.websiteUrl ?? '',
    industry: lead.category ?? profile.industry,
    source: 'scraper',
    channel: `Scraper · ${profile.name} · run #${lead.firstRunId}`,
    reason: buildReason(lead),
    temperature: 'nuevo',
    service: info.service,
    value: 0,
    mrr: 0,
    position: opts.position,
    assigned_to: opts.assignedTo,
    enrichment: buildEnrichment(lead, profile),
  };
}
