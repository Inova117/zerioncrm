// ============================================================================
// Zerion CRM — Domain types
// These map 1:1 to the Supabase tables described in README.md / supabase/schema.sql
// ============================================================================

export type UUID = string;
/** ISO 8601 timestamp string, e.g. "2026-07-03T14:20:00.000Z" */
export type ISODate = string;

// ---------------------------------------------------------------------------
// Users / auth
// ---------------------------------------------------------------------------
export type Role = 'admin' | 'employee';

export interface User {
  id: UUID;
  email: string;
  name: string;
  role: Role;
  avatarColor: string; // used for the avatar chip when there's no image
  active: boolean;
  createdAt: ISODate;
}

/** Only exists in the mock/local layer — Supabase Auth stores the real hash. */
export interface Credential {
  userId: UUID;
  email: string;
  password: string; // plaintext ONLY in the mock layer; never in Supabase
}

// ---------------------------------------------------------------------------
// Leads (prospective clients)
// ---------------------------------------------------------------------------

/** Pipeline stage === "temperature". Ordered coldest → won. */
export type Temperature =
  | 'nuevo'
  | 'frio'
  | 'tibio'
  | 'caliente'
  | 'reunion'
  | 'cliente'
  | 'perdido';

/** Where the prospect was found / first touched. */
export type Source =
  | 'linkedin'
  | 'instagram'
  | 'email'
  | 'whatsapp'
  | 'referido'
  | 'web'
  | 'evento'
  | 'llamada'
  | 'scraper'
  | 'otro';

/** Agency service line the opportunity is about. */
export type Service =
  | 'web'
  | 'app'
  | 'ecommerce'
  | 'branding'
  | 'marketing'
  | 'mantenimiento'
  | 'consultoria'
  | 'otro';

/**
 * Structured extras carried from the ZerionScraperAI pipeline (Google Maps).
 * Present only on scraper-sourced leads; powers the Lead Finder cards.
 */
export interface LeadEnrichment {
  rating?: number; // Google rating (e.g. 4.7)
  reviewCount?: number;
  city?: string;
  segment?: string; // has_website | no_website | social_only | parked
  whatTheyDo?: string;
  score?: number;
  whatsapp?: string;
  address?: string; // short address
  fullAddress?: string; // complete street address
  googleUrl?: string; // Google Maps / Business listing link (always available)
  image?: string; // photo of the business
  price?: string; // $ / $$ / $$$
  socials?: string[]; // social profile URLs (Instagram, Facebook…)
  email?: string; // scraped from the site (deep mode)
  placeId?: string;
  searchId?: string;
  runId?: number;
  profile?: string; // scraper campaign profile name
}

export interface Lead {
  id: UUID;
  company: string;
  contactName: string;
  role: string; // contact's job title
  email: string;
  phone: string;
  website: string;
  industry: string;
  source: Source;
  /** Free text: which channel / where they were written to. */
  channel: string;
  /** Why they are a potential client. */
  reason: string;
  temperature: Temperature;
  /** Agency service line (web, app, retainer…). */
  service: Service;
  /** One-time estimated project value in USD (0 if unknown). */
  value: number;
  /** Monthly recurring revenue / retainer in USD (0 if not a retainer). */
  mrr: number;
  /** Manual ordering within a Kanban column. */
  position: number;
  assignedTo: UUID; // employee/user id
  createdAt: ISODate;
  updatedAt: ISODate;
  lastContactAt: ISODate | null;
  /** Scheduled meeting date, when the lead reaches "reunion". */
  meetingAt: ISODate | null;
  /** Google-Maps enrichment from the scraper (null for hand-entered leads). */
  enrichment?: LeadEnrichment | null;
}

// ---------------------------------------------------------------------------
// Contacts — the people (stakeholders) at a prospect/account
// ---------------------------------------------------------------------------
export interface Contact {
  id: UUID;
  leadId: UUID;
  name: string;
  role: string; // job title / cargo
  email: string;
  phone: string;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Comments / activity timeline on a lead
// ---------------------------------------------------------------------------
export type ActivityType = 'comment' | 'stage_change' | 'contact' | 'meeting';

export interface Comment {
  id: UUID;
  leadId: UUID;
  authorId: UUID;
  type: ActivityType;
  body: string;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export type TaskCadence = 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: UUID;
  title: string;
  notes: string;
  cadence: TaskCadence;
  done: boolean;
  assignedTo: UUID;
  leadId: UUID | null; // optional link to a lead
  dueDate: ISODate | null;
  createdAt: ISODate;
  completedAt: ISODate | null;
  /** Recurring objective: auto-resets each cadence period (vs a one-off task). */
  recurring: boolean;
  /** Numeric goal for the period (0 = a plain done/undone task, no progress bar). */
  target: number;
  /** Current progress toward `target` in the period identified by `periodKey`. */
  progress: number;
  /** The period the progress/done belong to (e.g. "2026-07-08", "2026-W28",
   *  "2026-07"). If it's not the current period, progress/done read as reset. */
  periodKey: string | null;
}

// ---------------------------------------------------------------------------
// Derived / view models
// ---------------------------------------------------------------------------
export interface FunnelStage {
  temperature: Temperature;
  count: number;
}

export interface EmployeeStats {
  user: User;
  contacted: number; // total leads owned
  tibio: number;
  caliente: number;
  reuniones: number;
  clientes: number;
  perdidos: number;
  tasksDone: number;
  tasksTotal: number;
  conversionRate: number; // clientes / contacted
}
