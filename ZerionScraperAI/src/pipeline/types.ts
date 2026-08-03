import type { Db } from '../db/index.js';
import type { leads, LeadStatus, profiles } from '../db/schema.js';

export type Profile = typeof profiles.$inferSelect;
export type Lead = typeof leads.$inferSelect;

export interface StageContext {
  runId: number;
  profile: Profile;
}

/**
 * A per-lead stage moves leads from one status to the next. Handlers return
 * column updates; throwing marks the lead 'error' and the run continues.
 */
export interface LeadStage {
  name: string;
  from: LeadStatus;
  to: LeadStatus;
  handler: (db: Db, lead: Lead, ctx: StageContext) => Promise<Partial<Lead>>;
}

/** A lead as returned by any source, before dedupe/insert. */
export interface SourcedLead {
  placeId: string;
  name: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  reviews?: SourcedReview[];
}

export interface SourcedReview {
  author?: string | null;
  rating?: number | null;
  text?: string | null;
  date?: string | null;
}

export interface FetchResult {
  leads: SourcedLead[];
  /** Cost of this fetch in USD, recorded against the run. */
  costUsd: number;
  provider: string;
}

/**
 * Pluggable lead source (decision #2: Apify primary, Outscraper fallback is
 * one adapter away, fixture for tests).
 */
export interface LeadSource {
  readonly name: string;
  fetch(profile: Profile, limit: number): Promise<FetchResult>;
}
