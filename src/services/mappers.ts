// ============================================================================
// Row ⇆ model mappers. Supabase columns are snake_case; the app's types are
// camelCase. Keep ALL of that translation here so components/services never see
// raw rows. (resolves the camelCase↔snake_case gap, audit#1 #12)
// ============================================================================
import type { User, Lead, Contact, Comment, Task, Role, Temperature, Source, Service, TaskCadence, ActivityType } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  temperature: (r.temperature ?? 'nuevo') as Temperature,
  service: (r.service ?? 'otro') as Service,
  value: Number(r.value ?? 0),
  mrr: Number(r.mrr ?? 0),
  position: r.position ?? 0,
  assignedTo: r.assigned_to,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastContactAt: r.last_contact_at,
  meetingAt: r.meeting_at,
  enrichment: r.enrichment ?? null,
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
  if (l.temperature !== undefined) row.temperature = l.temperature;
  if (l.service !== undefined) row.service = l.service;
  if (l.value !== undefined) row.value = l.value;
  if (l.mrr !== undefined) row.mrr = l.mrr;
  if (l.position !== undefined) row.position = l.position;
  if (l.assignedTo !== undefined) row.assigned_to = l.assignedTo;
  if (l.lastContactAt !== undefined) row.last_contact_at = l.lastContactAt;
  if (l.meetingAt !== undefined) row.meeting_at = l.meetingAt;
  if (l.enrichment !== undefined) row.enrichment = l.enrichment;
  return row;
};

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
