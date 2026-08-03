import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Enums (SQLite has no native enums — enforced in app code via these unions)
// ---------------------------------------------------------------------------

export const LEAD_STATUSES = [
  'new', // ingested + deduped
  'segmented', // has_website / no_website / social_only / parked resolved
  'enriched', // email waterfall + language done
  'audited', // triage + playwright + PSI done (or skipped for no-website)
  'scored', // pain hypothesis + score computed
  'ready', // personalization variables generated, awaiting founder review
  'approved', // founder approved in dashboard
  'exported', // in an Instantly CSV export
  'pushed', // pushed via Instantly API (v1.1)
  'replied',
  'bounced',
  'unsubscribed',
  'disqualified',
  'error',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SEGMENTS = ['unknown', 'has_website', 'no_website', 'social_only', 'parked'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const EMAIL_SOURCES = ['site', 'facebook', 'outscraper', 'finder', 'maps', 'manual'] as const;
export type EmailSource = (typeof EMAIL_SOURCES)[number];

export const VERIFICATION_STATUSES = [
  'unverified',
  'valid',
  'role', // info@/contacto@ — grade B per decision #5
  'catch_all', // grade C — isolated campaign
  'invalid',
  'unknown',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type HasWebsiteFilter = 'yes' | 'no' | 'any';

export interface ProfileFilters {
  ratingMin?: number;
  ratingMax?: number;
  reviewCountMin?: number;
  reviewCountMax?: number;
  hasWebsite?: HasWebsiteFilter;
}

const createdAt = () =>
  integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`);

// ---------------------------------------------------------------------------
// F1 — Campaign profiles (industry is ALWAYS founder-chosen; system stays
// industry-agnostic)
// ---------------------------------------------------------------------------

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  industry: text('industry').notNull(), // e.g. "general contractor"
  geos: text('geos', { mode: 'json' }).$type<string[]>().notNull(), // e.g. ["Houston, TX"]
  language: text('language').$type<'es' | 'en' | 'auto'>().notNull().default('auto'),
  filters: text('filters', { mode: 'json' }).$type<ProfileFilters>().notNull().default({}),
  leadsPerDay: integer('leads_per_day').notNull().default(50),
  instantlyCampaignId: text('instantly_campaign_id'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// F2 — Daily runs (idempotent, logged, cost-tracked)
// ---------------------------------------------------------------------------

export const runs = sqliteTable(
  'runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id),
    status: text('status').$type<'running' | 'done' | 'failed'>().notNull().default('running'),
    leadsRequested: integer('leads_requested').notNull().default(0),
    leadsFetched: integer('leads_fetched').notNull().default(0),
    leadsNew: integer('leads_new').notNull().default(0),
    error: text('error'),
    startedAt: createdAt(),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
  },
  (t) => [index('runs_profile_idx').on(t.profileId)],
);

// ---------------------------------------------------------------------------
// Leads — hard dedupe on place_id + normalized domain + normalized phone (F2)
// ---------------------------------------------------------------------------

export const leads = sqliteTable(
  'leads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id),
    firstRunId: integer('first_run_id')
      .notNull()
      .references(() => runs.id),
    placeId: text('place_id').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    address: text('address'),
    city: text('city'),
    phone: text('phone'),
    normalizedPhone: text('normalized_phone'),
    websiteUrl: text('website_url'), // nullable — null is the high-intent signal
    normalizedDomain: text('normalized_domain'), // null for no site / social-only
    googleRating: real('google_rating'),
    reviewCount: integer('review_count'),
    language: text('language').$type<'es' | 'en'>(),
    whatTheyDo: text('what_they_do'), // F3 one-line summary
    decisionMakerName: text('decision_maker_name'),
    socialLinks: text('social_links', { mode: 'json' }).$type<string[]>(),
    whatsappPhone: text('whatsapp_phone'), // captured from wa.me links (no-website channel)
    segment: text('segment').$type<Segment>().notNull().default('unknown'),
    status: text('status').$type<LeadStatus>().notNull().default('new'),
    score: integer('score'),
    scoreReasons: text('score_reasons', { mode: 'json' }).$type<
      Array<{ reason: string; points: number }>
    >(),
    errorMessage: text('error_message'),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('leads_place_id_uq').on(t.placeId),
    index('leads_domain_idx').on(t.normalizedDomain),
    index('leads_phone_idx').on(t.normalizedPhone),
    index('leads_status_idx').on(t.status),
    index('leads_profile_idx').on(t.profileId),
    index('leads_score_idx').on(t.score),
  ],
);

// ---------------------------------------------------------------------------
// F3 — Emails from the waterfall (several per lead, graded A/B/C)
// ---------------------------------------------------------------------------

export const leadEmails = sqliteTable(
  'lead_emails',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id),
    email: text('email').notNull(),
    source: text('source').$type<EmailSource>().notNull(),
    verificationStatus: text('verification_status')
      .$type<VerificationStatus>()
      .notNull()
      .default('unverified'),
    grade: text('grade').$type<'A' | 'B' | 'C'>(), // valid=A, role=B, catch_all=C
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    verifiedAt: integer('verified_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('lead_emails_lead_email_uq').on(t.leadId, t.email),
    index('lead_emails_lead_idx').on(t.leadId),
  ],
);

// ---------------------------------------------------------------------------
// F4 — Website audit results (one per lead)
// ---------------------------------------------------------------------------

export const audits = sqliteTable(
  'audits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id),
    // browserless triage
    httpStatus: integer('http_status'),
    siteUp: integer('site_up', { mode: 'boolean' }),
    parked: integer('parked', { mode: 'boolean' }),
    sslOk: integer('ssl_ok', { mode: 'boolean' }),
    sslExpiresAt: integer('ssl_expires_at', { mode: 'timestamp' }),
    copyrightYear: integer('copyright_year'),
    analyticsDetected: integer('analytics_detected', { mode: 'boolean' }),
    detectedLanguage: text('detected_language').$type<'es' | 'en'>(),
    // playwright mobile pass
    mobileUsable: integer('mobile_usable', { mode: 'boolean' }),
    ctas: text('ctas', { mode: 'json' }).$type<{
      booking?: boolean;
      whatsapp?: boolean;
      quote?: boolean;
      form?: boolean;
      phone?: boolean;
    }>(),
    deadSocials: text('dead_socials', { mode: 'json' }).$type<string[]>(),
    brokenLinksCount: integer('broken_links_count'),
    pageWeightKb: integer('page_weight_kb'),
    screenshotPath: text('screenshot_path'),
    // PSI
    psiPerformance: integer('psi_performance'),
    lcpMs: integer('lcp_ms'),
    raw: text('raw', { mode: 'json' }).$type<Record<string, unknown>>(),
    runAt: createdAt(),
  },
  (t) => [uniqueIndex('audits_lead_uq').on(t.leadId)],
);

// ---------------------------------------------------------------------------
// Reviews — internal LLM input ONLY (never republished; Google ToS)
// ---------------------------------------------------------------------------

export const reviews = sqliteTable(
  'reviews',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id),
    author: text('author'),
    rating: integer('rating'),
    text: text('text'),
    reviewDate: text('review_date'),
    createdAt: createdAt(),
  },
  (t) => [index('reviews_lead_idx').on(t.leadId)],
);

// ---------------------------------------------------------------------------
// Findings — F10 traceability: every generated claim must reference one
// ---------------------------------------------------------------------------

export const findings = sqliteTable(
  'findings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id),
    type: text('type').notNull(), // e.g. 'broken_site' | 'no_ssl' | 'slow_mobile' | ...
    hookRank: integer('hook_rank').notNull(), // 1 = most compelling (report 01 §6 ranking)
    claimEs: text('claim_es').notNull(),
    claimEn: text('claim_en').notNull(),
    evidence: text('evidence', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    verifiedAt: integer('verified_at', { mode: 'timestamp' }), // re-verify <24h before send
    createdAt: createdAt(),
  },
  (t) => [index('findings_lead_idx').on(t.leadId)],
);

// ---------------------------------------------------------------------------
// F5 + F10 — pain hypothesis & personalization variables (one row per lead)
// ---------------------------------------------------------------------------

export const variables = sqliteTable(
  'variables',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id),
    firstLine: text('first_line').notNull(),
    painPoint: text('pain_point').notNull(),
    psLine: text('ps_line'),
    language: text('language').$type<'es' | 'en'>().notNull(),
    sourceFindingIds: text('source_finding_ids', { mode: 'json' }).$type<number[]>().notNull(),
    model: text('model').notNull(),
    approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
    editedByFounder: integer('edited_by_founder', { mode: 'boolean' }).notNull().default(false),
    generatedAt: createdAt(),
  },
  (t) => [uniqueIndex('variables_lead_uq').on(t.leadId)],
);

// ---------------------------------------------------------------------------
// F8/F9 — export & push log
// ---------------------------------------------------------------------------

export const pushes = sqliteTable(
  'pushes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id),
    method: text('method').$type<'csv' | 'api' | 'crm'>().notNull(),
    campaignId: text('campaign_id'),
    status: text('status').$type<'exported' | 'pushed' | 'failed' | 'skipped'>().notNull(),
    // For method='crm' this holds the CRM (Supabase) lead UUID we created.
    instantlyLeadId: text('instantly_lead_id'),
    error: text('error'),
    pushedAt: createdAt(),
  },
  (t) => [index('pushes_lead_idx').on(t.leadId)],
);

// ---------------------------------------------------------------------------
// Per-lead cost tracking (NFR) — USD; fractions matter ($0.004/place)
// ---------------------------------------------------------------------------

export const costs = sqliteTable(
  'costs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id').references(() => leads.id),
    runId: integer('run_id').references(() => runs.id),
    stage: text('stage').notNull(), // 'ingest' | 'enrich' | 'audit' | 'llm' | ...
    provider: text('provider').notNull(), // 'apify' | 'reoon' | 'openrouter' | ...
    amountUsd: real('amount_usd').notNull(),
    meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('costs_run_idx').on(t.runId), index('costs_lead_idx').on(t.leadId)],
);

// ---------------------------------------------------------------------------
// CAN-SPAM suppression list — the exporter ALWAYS checks this
// ---------------------------------------------------------------------------

export const suppression = sqliteTable('suppression', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  reason: text('reason').$type<'opt_out' | 'bounce' | 'complaint' | 'manual'>().notNull(),
  addedAt: createdAt(),
});
