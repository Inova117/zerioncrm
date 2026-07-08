import type { Lead, Contact, Comment, Temperature, ActivityType } from '../types';
import { table, delay } from './db';
import { uid, nowISO } from '../lib/utils';
import { stageLabel } from '../lib/constants';
import { supabase } from '../lib/supabaseClient';
import { rowToLead, leadToRow, rowToComment, rowToContact, contactToRow } from './mappers';

export interface NewContactInput {
  leadId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
}

export type NewLeadInput = Omit<
  Lead,
  'id' | 'createdAt' | 'updatedAt' | 'position' | 'lastContactAt' | 'meetingAt'
> &
  Partial<Pick<Lead, 'lastContactAt' | 'meetingAt'>>;

export interface LeadsService {
  list(): Promise<Lead[]>;
  create(input: NewLeadInput): Promise<Lead>;
  update(id: string, patch: Partial<Lead>): Promise<Lead | null>;
  move(id: string, temperature: Temperature, authorId: string): Promise<Lead | null>;
  reorderColumn(temperature: Temperature, orderedVisibleIds: string[]): Promise<void>;
  remove(id: string): Promise<void>;
  comments(leadId: string): Promise<Comment[]>;
  commentCounts(): Promise<Record<string, number>>;
  addActivity(leadId: string, authorId: string, type: ActivityType, body: string): Promise<Comment>;
  removeComment(id: string): Promise<void>;
  // Contacts (stakeholders) on a lead
  allContacts(): Promise<Contact[]>;
  listContacts(leadId: string): Promise<Contact[]>;
  addContact(input: NewContactInput): Promise<Contact>;
  updateContact(id: string, patch: Partial<Contact>): Promise<void>;
  removeContact(id: string): Promise<void>;
}

function tally(leadIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of leadIds) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------
async function maxPosition(temperature: Temperature): Promise<number> {
  const { data } = await supabase!
    .from('leads')
    .select('position')
    .eq('temperature', temperature)
    .order('position', { ascending: false })
    .limit(1);
  return data && data.length ? (data[0].position as number) : 0;
}

const supabaseLeadsService: LeadsService = {
  async list() {
    const { data, error } = await supabase!.from('leads').select('*').order('position');
    if (error) throw error;
    return (data ?? []).map(rowToLead);
  },

  async create(input) {
    const row = {
      ...leadToRow(input),
      position: (await maxPosition(input.temperature)) + 1,
      last_contact_at: input.lastContactAt ?? nowISO(),
      meeting_at: input.meetingAt ?? null,
    };
    const { data, error } = await supabase!.from('leads').insert(row).select().single();
    if (error) throw error;
    return rowToLead(data);
  },

  async update(id, patch) {
    const { data, error } = await supabase!
      .from('leads')
      .update(leadToRow(patch))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data ? rowToLead(data) : null;
  },

  async move(id, temperature, authorId) {
    const { data: cur } = await supabase!.from('leads').select('*').eq('id', id).single();
    if (!cur) return null;
    const current = rowToLead(cur);
    if (current.temperature === temperature) return current;

    const patch: Partial<Lead> = {
      temperature,
      lastContactAt: nowISO(),
      position: (await maxPosition(temperature)) + 1, // land at bottom of destination
    };
    if (temperature === 'reunion' && !current.meetingAt) patch.meetingAt = nowISO();

    const updated = await this.update(id, patch);
    await this.addActivity(
      id,
      authorId,
      'stage_change',
      `Movió de ${stageLabel(current.temperature)} a ${stageLabel(temperature)}`
    );
    return updated;
  },

  async reorderColumn(temperature, orderedVisibleIds) {
    const { data } = await supabase!
      .from('leads')
      .select('id, position')
      .eq('temperature', temperature)
      .order('position');
    const colSorted = data ?? [];
    const visible = new Set(orderedVisibleIds);
    let vi = 0;
    const mergedIds = colSorted.map((l) =>
      visible.has(l.id) && vi < orderedVisibleIds.length ? orderedVisibleIds[vi++] : l.id
    );
    // Persist only the rows whose position actually changed.
    await Promise.all(
      mergedIds.map((rid, i) =>
        colSorted.find((l) => l.id === rid)?.position === i
          ? Promise.resolve()
          : supabase!.from('leads').update({ position: i }).eq('id', rid)
      )
    );
  },

  async remove(id) {
    // FK: comments cascade-delete, tasks.lead_id → null, all server-side.
    const { error } = await supabase!.from('leads').delete().eq('id', id);
    if (error) throw error;
  },

  async comments(leadId) {
    const { data, error } = await supabase!
      .from('comments')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToComment);
  },

  async commentCounts() {
    const { data } = await supabase!.from('comments').select('lead_id');
    return tally((data ?? []).map((r) => r.lead_id as string));
  },

  async addActivity(leadId, authorId, type, body) {
    const { data, error } = await supabase!
      .from('comments')
      .insert({ lead_id: leadId, author_id: authorId, type, body })
      .select()
      .single();
    if (error) throw error;
    return rowToComment(data);
  },

  async removeComment(id) {
    const { error } = await supabase!.from('comments').delete().eq('id', id);
    if (error) throw error;
  },

  async allContacts() {
    const { data, error } = await supabase!
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToContact);
  },

  async listContacts(leadId) {
    const { data, error } = await supabase!
      .from('contacts')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToContact);
  },

  async addContact(input) {
    const { data, error } = await supabase!
      .from('contacts')
      .insert(contactToRow(input))
      .select()
      .single();
    if (error) throw error;
    return rowToContact(data);
  },

  async updateContact(id, patch) {
    const { error } = await supabase!.from('contacts').update(contactToRow(patch)).eq('id', id);
    if (error) throw error;
  },

  async removeContact(id) {
    const { error } = await supabase!.from('contacts').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Mock implementation (local dev)
// ---------------------------------------------------------------------------
const mockLeadsService: LeadsService = {
  async list() {
    await delay();
    return [...table.get('leads')];
  },

  async create(input) {
    await delay();
    const leads = table.get('leads');
    const maxPos = leads.reduce((m, l) => Math.max(m, l.position), 0);
    const lead: Lead = {
      ...input,
      id: uid('lead-'),
      position: maxPos + 1,
      lastContactAt: input.lastContactAt ?? nowISO(),
      meetingAt: input.meetingAt ?? null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    table.set('leads', [...leads, lead]);
    return lead;
  },

  async update(id, patch) {
    await delay();
    let updated: Lead | null = null;
    table.set(
      'leads',
      table.get('leads').map((l) => {
        if (l.id !== id) return l;
        updated = { ...l, ...patch, updatedAt: nowISO() };
        return updated;
      })
    );
    return updated;
  },

  async move(id, temperature, authorId) {
    await delay(60);
    const current = table.get('leads').find((l) => l.id === id);
    if (!current || current.temperature === temperature) return current ?? null;
    const patch: Partial<Lead> = {
      temperature,
      lastContactAt: nowISO(),
      position:
        table.get('leads').filter((l) => l.temperature === temperature).reduce((m, l) => Math.max(m, l.position), 0) + 1,
    };
    if (temperature === 'reunion' && !current.meetingAt) patch.meetingAt = nowISO();
    const updated = await this.update(id, patch);
    await this.addActivity(
      id,
      authorId,
      'stage_change',
      `Movió de ${stageLabel(current.temperature)} a ${stageLabel(temperature)}`
    );
    return updated;
  },

  async reorderColumn(temperature, orderedVisibleIds) {
    const all = table.get('leads');
    const visible = new Set(orderedVisibleIds);
    const colSorted = all
      .filter((l) => l.temperature === temperature)
      .sort((a, b) => a.position - b.position);
    let vi = 0;
    const mergedIds = colSorted.map((l) =>
      visible.has(l.id) && vi < orderedVisibleIds.length ? orderedVisibleIds[vi++] : l.id
    );
    const posById = new Map(mergedIds.map((id, i) => [id, i]));
    table.set('leads', all.map((l) => (posById.has(l.id) ? { ...l, position: posById.get(l.id)! } : l)));
  },

  async remove(id) {
    await delay();
    table.set('leads', table.get('leads').filter((l) => l.id !== id));
    table.set('comments', table.get('comments').filter((c) => c.leadId !== id));
    table.set('contacts', table.get('contacts').filter((c) => c.leadId !== id));
    table.set('tasks', table.get('tasks').map((t) => (t.leadId === id ? { ...t, leadId: null } : t)));
  },

  async comments(leadId) {
    await delay(60);
    return table
      .get('comments')
      .filter((c) => c.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async commentCounts() {
    return tally(table.get('comments').map((c) => c.leadId));
  },

  async addActivity(leadId, authorId, type, body) {
    const comment: Comment = {
      id: uid('c-'),
      leadId,
      authorId,
      type,
      body,
      createdAt: nowISO(),
    };
    table.set('comments', [...table.get('comments'), comment]);
    return comment;
  },

  async removeComment(id) {
    await delay(60);
    table.set('comments', table.get('comments').filter((c) => c.id !== id));
  },

  async allContacts() {
    await delay(60);
    return [...table.get('contacts')].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async listContacts(leadId) {
    await delay(60);
    return table
      .get('contacts')
      .filter((c) => c.leadId === leadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async addContact(input) {
    await delay();
    const contact: Contact = { ...input, id: uid('ct-'), createdAt: nowISO() };
    table.set('contacts', [...table.get('contacts'), contact]);
    return contact;
  },

  async updateContact(id, patch) {
    await delay();
    table.set('contacts', table.get('contacts').map((c) => (c.id === id ? { ...c, ...patch } : c)));
  },

  async removeContact(id) {
    await delay(60);
    table.set('contacts', table.get('contacts').filter((c) => c.id !== id));
  },
};

export const leadsService: LeadsService = supabase ? supabaseLeadsService : mockLeadsService;
