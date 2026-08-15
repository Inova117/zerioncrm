// ============================================================================
// Row ⇆ model mappers. Supabase columns are snake_case; the app's types are
// camelCase. Keep ALL of that translation here so components/services never see
// raw rows. (resolves the camelCase↔snake_case gap, audit#1 #12)
// ============================================================================
import type { User, Lead, Contact, Comment, Task, Discovery, SearchSummary, Role, Source, Service, TaskCadence, ActivityType, RoadmapDay, RoadmapActivity, RoadmapPhase, RoadmapActivityStatus, RoadmapClient, RoadmapProduct, RoadmapClientStatus, CashMove } from '../types';
import { normalizeTemperature } from '../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- lead_searches ⇆ SearchSummary ------------------------------------------
export const rowToSearch = (r: any): SearchSummary => ({
  id: r.id,
  businessType: r.business_type ?? '',
  location: r.location ?? '',
  status: r.status ?? 'running',
  found: Number(r.found ?? 0),
  duplicates: Number(r.duplicates ?? 0),
  noWebsite: Number(r.no_website ?? 0),
  results: Array.isArray(r.results) ? r.results : [],
  error: r.error ?? null,
  createdAt: r.created_at,
  finishedAt: r.finished_at ?? null,
});

// ---- profiles ⇆ User -------------------------------------------------------
export const rowToUser = (r: any): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role as Role,
  avatarColor: r.avatar_color,
  active: r.active,
  createdAt: r.created_at,
});

// ---- leads ⇆ Lead ----------------------------------------------------------
export const rowToLead = (r: any): Lead => ({
  id: r.id,
  company: r.company,
  contactName: r.contact_name ?? '',
  role: r.role ?? '',
  email: r.email ?? '',
  phone: r.phone ?? '',
  website: r.website ?? '',
  industry: r.industry ?? '',
  source: (r.source ?? 'otro') as Source,
  channel: r.channel ?? '',
  reason: r.reason ?? '',
  script: r.script ?? '',
  // Filas viejas (pipeline v1) llegan con frio/tibio/caliente/reunion/no-acepto:
  // se normalizan al pipeline v2 al leer. Nunca saca al lead del tablero.
  temperature: normalizeTemperature(r.temperature),
  service: (r.service ?? 'otro') as Service,
  value: Number(r.value ?? 0),
  mrr: Number(r.mrr ?? 0),
  position: r.position ?? 0,
  assignedTo: r.assigned_to,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastContactAt: r.last_contact_at,
  meetingAt: r.meeting_at,
  nextActionAt: r.next_action_at ?? null,
  touch: Number(r.touch ?? 0),
  enrichment: r.enrichment ?? null,
  metaLeadId: r.meta_lead_id ?? null,
  fbclid: r.fbclid ?? null,
});

/** Only the columns we actually write (id/created_at/updated_at are DB-managed). */
export const leadToRow = (l: Partial<Lead>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (l.company !== undefined) row.company = l.company;
  if (l.contactName !== undefined) row.contact_name = l.contactName;
  if (l.role !== undefined) row.role = l.role;
  if (l.email !== undefined) row.email = l.email;
  if (l.phone !== undefined) row.phone = l.phone;
  if (l.website !== undefined) row.website = l.website;
  if (l.industry !== undefined) row.industry = l.industry;
  if (l.source !== undefined) row.source = l.source;
  if (l.channel !== undefined) row.channel = l.channel;
  if (l.reason !== undefined) row.reason = l.reason;
  if (l.script !== undefined) row.script = l.script;
  if (l.temperature !== undefined) row.temperature = l.temperature;
  if (l.service !== undefined) row.service = l.service;
  if (l.value !== undefined) row.value = l.value;
  if (l.mrr !== undefined) row.mrr = l.mrr;
  if (l.position !== undefined) row.position = l.position;
  if (l.assignedTo !== undefined) row.assigned_to = l.assignedTo;
  if (l.lastContactAt !== undefined) row.last_contact_at = l.lastContactAt;
  if (l.meetingAt !== undefined) row.meeting_at = l.meetingAt;
  if (l.nextActionAt !== undefined) row.next_action_at = l.nextActionAt;
  if (l.touch !== undefined) row.touch = l.touch;
  if (l.enrichment !== undefined) row.enrichment = l.enrichment;
  if (l.metaLeadId !== undefined) row.meta_lead_id = l.metaLeadId;
  if (l.fbclid !== undefined) row.fbclid = l.fbclid;
  return row;
};

// ---- lead_discoveries ⇆ Discovery ------------------------------------------
export const rowToDiscovery = (r: any): Discovery => ({
  id: r.id,
  placeId: r.place_id,
  company: r.company,
  contactName: r.contact_name ?? '',
  role: r.role ?? '',
  email: r.email ?? '',
  phone: r.phone ?? '',
  website: r.website ?? '',
  industry: r.industry ?? '',
  channel: r.channel ?? '',
  reason: r.reason ?? '',
  service: (r.service ?? 'otro') as Service,
  assignedTo: r.assigned_to,
  discoveredBy: r.discovered_by,
  createdAt: r.created_at,
  enrichment: r.enrichment ?? null,
});

// ---- contacts ⇆ Contact ----------------------------------------------------
export const rowToContact = (r: any): Contact => ({
  id: r.id,
  leadId: r.lead_id,
  name: r.name,
  role: r.role ?? '',
  email: r.email ?? '',
  phone: r.phone ?? '',
  createdAt: r.created_at,
});

export const contactToRow = (c: Partial<Contact>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (c.leadId !== undefined) row.lead_id = c.leadId;
  if (c.name !== undefined) row.name = c.name;
  if (c.role !== undefined) row.role = c.role;
  if (c.email !== undefined) row.email = c.email;
  if (c.phone !== undefined) row.phone = c.phone;
  return row;
};

// ---- comments ⇆ Comment ----------------------------------------------------
export const rowToComment = (r: any): Comment => ({
  id: r.id,
  leadId: r.lead_id,
  authorId: r.author_id,
  type: (r.type ?? 'comment') as ActivityType,
  body: r.body,
  createdAt: r.created_at,
});

// ---- tasks ⇆ Task ----------------------------------------------------------
export const rowToTask = (r: any): Task => ({
  id: r.id,
  title: r.title,
  notes: r.notes ?? '',
  cadence: (r.cadence ?? 'daily') as TaskCadence,
  done: r.done,
  assignedTo: r.assigned_to,
  leadId: r.lead_id,
  dueDate: r.due_date,
  createdAt: r.created_at,
  completedAt: r.completed_at,
  recurring: r.recurring ?? false,
  target: Number(r.target ?? 0),
  progress: Number(r.progress ?? 0),
  periodKey: r.period_key ?? null,
});

export const taskToRow = (t: Partial<Task>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (t.title !== undefined) row.title = t.title;
  if (t.notes !== undefined) row.notes = t.notes;
  if (t.cadence !== undefined) row.cadence = t.cadence;
  if (t.done !== undefined) row.done = t.done;
  if (t.assignedTo !== undefined) row.assigned_to = t.assignedTo;
  if (t.leadId !== undefined) row.lead_id = t.leadId;
  if (t.dueDate !== undefined) row.due_date = t.dueDate;
  if (t.completedAt !== undefined) row.completed_at = t.completedAt;
  if (t.recurring !== undefined) row.recurring = t.recurring;
  if (t.target !== undefined) row.target = t.target;
  if (t.progress !== undefined) row.progress = t.progress;
  if (t.periodKey !== undefined) row.period_key = t.periodKey;
  return row;
};

// ---- roadmap_days ⇆ RoadmapDay (key = day, owner va por columna) ----------
export const rowToRoadmapDay = (r: any): RoadmapDay => ({
  day: r.day,
  contacts: Number(r.contacts ?? 0),
  demos: Number(r.demos ?? 0),
  webs: Number(r.webs ?? 0),
  aaas: Number(r.aaas ?? 0),
  income: Number(r.income ?? 0),
  content: r.content ?? false,
  notes: r.notes ?? '',
});

export const roadmapDayToRow = (d: RoadmapDay): Record<string, unknown> => ({
  day: d.day,
  contacts: d.contacts,
  demos: d.demos,
  webs: d.webs,
  aaas: d.aaas,
  income: d.income,
  content: d.content,
  notes: d.notes,
});

// ---- roadmap_activities ⇆ RoadmapActivity ----------------------------------
export const rowToRoadmapActivity = (r: any): RoadmapActivity => ({
  id: r.id,
  week: Number(r.week ?? 1),
  phase: (r.phase ?? 'Ventas') as RoadmapPhase,
  title: r.title ?? '',
  responsible: r.responsible ?? 'Martin',
  dueDate: r.due_date ?? null,
  status: (r.status ?? 'pendiente') as RoadmapActivityStatus,
  isGate: r.is_gate ?? false,
  sort: Number(r.sort ?? 0),
});

// ---- roadmap_clients ⇆ RoadmapClient ----------------------------------------
export const rowToRoadmapClient = (r: any): RoadmapClient => ({
  id: r.id,
  name: r.name ?? '',
  product: (r.product ?? 'web') as RoadmapProduct,
  startDate: r.start_date ?? null,
  setup: Number(r.setup ?? 0),
  monthly: Number(r.monthly ?? 0),
  status: (r.status ?? 'activo') as RoadmapClientStatus,
  notes: r.notes ?? '',
});

export const roadmapClientToRow = (c: Partial<RoadmapClient>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (c.name !== undefined) row.name = c.name;
  if (c.product !== undefined) row.product = c.product;
  if (c.startDate !== undefined) row.start_date = c.startDate;
  if (c.setup !== undefined) row.setup = c.setup;
  if (c.monthly !== undefined) row.monthly = c.monthly;
  if (c.status !== undefined) row.status = c.status;
  if (c.notes !== undefined) row.notes = c.notes;
  return row;
};

// ---- roadmap_cash ⇆ CashMove -------------------------------------------------
export const rowToCashMove = (r: any): CashMove => ({
  id: r.id,
  day: r.day,
  concept: r.concept ?? '',
  income: Number(r.income ?? 0),
  expense: Number(r.expense ?? 0),
});

export const cashMoveToRow = (m: Omit<CashMove, 'id'>): Record<string, unknown> => ({
  day: m.day,
  concept: m.concept,
  income: m.income,
  expense: m.expense,
});
