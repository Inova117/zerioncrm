import type { Db } from '../../db/index.js';
import { leads, reviews } from '../../db/schema.js';
import { recordCost } from '../../lib/costs.js';
import { logger } from '../../lib/logger.js';
import { withRetry } from '../../lib/retry.js';
import { dedupeAgainstHistory } from '../dedupe.js';
import type { LeadSource, Profile } from '../types.js';

export interface IngestResult {
  fetched: number;
  inserted: number;
  duplicates: number;
}

/**
 * F2: pull a configurable number of NEW leads for a profile, hard-deduped
 * against full history. Idempotent: re-running only inserts unseen places.
 */
export async function ingest(
  db: Db,
  source: LeadSource,
  profile: Profile,
  runId: number,
): Promise<IngestResult> {
  const limit = profile.leadsPerDay;
  const result = await withRetry(() => source.fetch(profile, limit), {
    label: `ingest:${source.name}`,
  });

  if (result.costUsd > 0) {
    recordCost(db, {
      runId,
      stage: 'ingest',
      provider: result.provider,
      amountUsd: result.costUsd,
      meta: { fetched: result.leads.length },
    });
  }

  const { fresh, duplicates } = dedupeAgainstHistory(db, result.leads);
  // Respect the profile's daily target AFTER dedupe (oversampling upstream).
  const toInsert = fresh.slice(0, limit);

  let inserted = 0;
  for (const lead of toInsert) {
    db.transaction((tx) => {
      const [row] = tx
        .insert(leads)
        .values({
          profileId: profile.id,
          firstRunId: runId,
          placeId: lead.placeId,
          name: lead.name,
          category: lead.category ?? null,
          address: lead.address ?? null,
          city: lead.city ?? null,
          phone: lead.phone ?? null,
          normalizedPhone: lead.normalizedPhone,
          websiteUrl: lead.websiteUrl ?? null,
          normalizedDomain: lead.normalizedDomain,
          googleRating: lead.googleRating ?? null,
          reviewCount: lead.reviewCount ?? null,
          status: 'new',
        })
        .onConflictDoNothing({ target: leads.placeId })
        .returning({ id: leads.id })
        .all();

      if (!row) return; // conflict — another run inserted it concurrently
      inserted++;

      const reviewRows = (lead.reviews ?? [])
        .filter((r) => r.text || r.rating != null)
        .map((r) => ({
          leadId: row.id,
          author: r.author ?? null,
          rating: r.rating ?? null,
          text: r.text ?? null,
          reviewDate: r.date ?? null,
        }));
      if (reviewRows.length) tx.insert(reviews).values(reviewRows).run();
    });
  }

  logger.info(
    { profile: profile.name, fetched: result.leads.length, inserted, duplicates },
    'ingest done',
  );
  return { fetched: result.leads.length, inserted, duplicates };
}
