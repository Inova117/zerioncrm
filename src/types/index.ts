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
