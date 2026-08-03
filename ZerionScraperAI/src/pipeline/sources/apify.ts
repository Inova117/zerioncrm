import { ApifyClient } from 'apify-client';
import { requireEnv } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import type { FetchResult, LeadSource, Profile, SourcedLead } from '../types.js';

const ACTOR_ID = 'compass/crawler-google-places';

// Verified pay-per-event pricing (help.apify.com, 2026-07-14):
// $0.007/actor start + $0.004/place + $0.0005/review.
const COST_PER_START = 0.007;
const COST_PER_PLACE = 0.004;
const COST_PER_REVIEW = 0.0005;
const MAX_REVIEWS_PER_PLACE = 10;

/** Raw dataset item shape — only the fields we consume. Field names should be
 * validated against a real run on day 3 (they follow the actor's documented
 * output schema). */
interface ApifyPlaceItem {
  placeId?: string;
  title?: string;
  categoryName?: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  reviews?: Array<{
    name?: string;
    stars?: number;
    text?: string;
    publishedAtDate?: string;
  }>;
}

export class ApifySource implements LeadSource {
  readonly name = 'apify';
  private readonly client: ApifyClient;

  constructor() {
    this.client = new ApifyClient({ token: requireEnv('APIFY_TOKEN') });
  }

  async fetch(profile: Profile, limit: number): Promise<FetchResult> {
    // Oversample: dedupe against history will discard already-seen places.
    const perSearch = Math.max(20, Math.ceil((limit * 3) / profile.geos.length));

    const input = {
      searchStringsArray: profile.geos.map((geo) => `${profile.industry} in ${geo}`),
      maxCrawledPlacesPerSearch: perSearch,
      maxReviews: MAX_REVIEWS_PER_PLACE,
      reviewsSort: 'newest',
      language: 'en',
      skipClosedPlaces: true,
      scrapeContacts: false, // enrichment is our own stage 2 — keeps cost at $0.004/place
    };

    logger.info({ actor: ACTOR_ID, searches: input.searchStringsArray, perSearch }, 'apify run start');
    const run = await this.client.actor(ACTOR_ID).call(input);
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

    const leads: SourcedLead[] = [];
    let reviewCount = 0;
    for (const raw of items as ApifyPlaceItem[]) {
      if (!raw.placeId || !raw.title) continue;
      const reviews = (raw.reviews ?? []).map((r) => ({
        author: r.name ?? null,
        rating: r.stars ?? null,
        text: r.text ?? null,
        date: r.publishedAtDate ?? null,
      }));
      reviewCount += reviews.length;
      leads.push({
        placeId: raw.placeId,
        name: raw.title,
        category: raw.categoryName ?? null,
        address: raw.address ?? null,
        city: raw.city ?? null,
        phone: raw.phone ?? null,
        websiteUrl: raw.website ?? null,
        googleRating: raw.totalScore ?? null,
        reviewCount: raw.reviewsCount ?? null,
        reviews,
      });
    }

    const costUsd = COST_PER_START + leads.length * COST_PER_PLACE + reviewCount * COST_PER_REVIEW;
    logger.info({ places: leads.length, reviews: reviewCount, costUsd }, 'apify run done');
    return { leads, costUsd, provider: this.name };
  }
}
