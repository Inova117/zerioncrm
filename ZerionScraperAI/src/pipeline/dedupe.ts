import { inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { leads } from '../db/schema.js';
import { normalizeDomain, normalizePhone } from '../lib/normalize.js';
import type { SourcedLead } from './types.js';

export interface DedupeResult {
  fresh: Array<SourcedLead & { normalizedDomain: string | null; normalizedPhone: string | null }>;
  duplicates: number;
}

/**
 * F2 hard dedupe against FULL history: place_id, normalized domain, normalized
 * phone. Also dedupes within the incoming batch itself.
 */
export function dedupeAgainstHistory(db: Db, incoming: SourcedLead[]): DedupeResult {
  const normalized = incoming.map((lead) => ({
    ...lead,
    normalizedDomain: normalizeDomain(lead.websiteUrl),
    normalizedPhone: normalizePhone(lead.phone),
  }));

  const placeIds = normalized.map((l) => l.placeId);
  const domains = normalized.map((l) => l.normalizedDomain).filter((d): d is string => d !== null);
  const phones = normalized.map((l) => l.normalizedPhone).filter((p): p is string => p !== null);

  const seenPlaceIds = new Set(
    placeIds.length
      ? db
          .select({ v: leads.placeId })
          .from(leads)
          .where(inArray(leads.placeId, placeIds))
          .all()
          .map((r) => r.v)
      : [],
  );
  const seenDomains = new Set(
    domains.length
      ? db
          .select({ v: leads.normalizedDomain })
          .from(leads)
          .where(inArray(leads.normalizedDomain, domains))
          .all()
          .map((r) => r.v)
      : [],
  );
  const seenPhones = new Set(
    phones.length
      ? db
          .select({ v: leads.normalizedPhone })
          .from(leads)
          .where(inArray(leads.normalizedPhone, phones))
          .all()
          .map((r) => r.v)
      : [],
  );

  const fresh: DedupeResult['fresh'] = [];
  let duplicates = 0;
  for (const lead of normalized) {
    const isDupe =
      seenPlaceIds.has(lead.placeId) ||
      (lead.normalizedDomain !== null && seenDomains.has(lead.normalizedDomain)) ||
      (lead.normalizedPhone !== null && seenPhones.has(lead.normalizedPhone));
    if (isDupe) {
      duplicates++;
      continue;
    }
    fresh.push(lead);
    // Guard against duplicates inside the same batch.
    seenPlaceIds.add(lead.placeId);
    if (lead.normalizedDomain) seenDomains.add(lead.normalizedDomain);
    if (lead.normalizedPhone) seenPhones.add(lead.normalizedPhone);
  }

  return { fresh, duplicates };
}
