import type { Lead, Comment, Temperature, ActivityType } from '../types';
import { table, delay } from './db';
import { uid, nowISO } from '../lib/utils';
import { stageLabel } from '../lib/constants';

export type NewLeadInput = Omit<
  Lead,
  'id' | 'createdAt' | 'updatedAt' | 'position' | 'lastContactAt' | 'meetingAt'
> &
  Partial<Pick<Lead, 'lastContactAt' | 'meetingAt'>>;

export const leadsService = {
  /** SUPABASE: supabase.from('leads').select('*').order('position') */
  async list(): Promise<Lead[]> {
    await delay();
    return [...table.get('leads')];
  },

  async create(input: NewLeadInput): Promise<Lead> {
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

  async update(id: string, patch: Partial<Lead>): Promise<Lead | null> {
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

  /**
   * Move a lead to another stage (drag & drop). Records a stage_change activity.
   * SUPABASE: update leads set temperature=:t, position=:p; insert into comments(...)
   */
  async move(
    id: string,
    temperature: Temperature,
    authorId: string
  ): Promise<Lead | null> {
    await delay(60);
    const current = table.get('leads').find((l) => l.id === id);
    if (!current || current.temperature === temperature) {
      return current ?? null;
    }
    const patch: Partial<Lead> = {
      temperature,
      lastContactAt: nowISO(),
      // Land at the bottom of the destination column so a stage change from the
      // detail modal (no drag position) doesn't drop the card at a random spot. (#6)
      position:
        table
          .get('leads')
          .filter((l) => l.temperature === temperature)
          .reduce((m, l) => Math.max(m, l.position), 0) + 1,
    };
    if (temperature === 'reunion' && !current.meetingAt) {
      patch.meetingAt = nowISO();
    }
    const updated = await this.update(id, patch);
    await this.addActivity(
      id,
      authorId,
      'stage_change',
      `Movió de ${stageLabel(current.temperature)} a ${stageLabel(temperature)}`
    );
    return updated;
  },

  /**
   * Reorder a single column. `orderedVisibleIds` is the new order of the leads
   * the user can actually see (the board may be filtered by owner/search). We
   * splice that order back into the FULL column so hidden leads keep their
   * relative slots instead of being scrambled. (bug #4)
   */
  async reorderColumn(temperature: Temperature, orderedVisibleIds: string[]): Promise<void> {
    const all = table.get('leads');
    const visible = new Set(orderedVisibleIds);
    const colSorted = all
      .filter((l) => l.temperature === temperature)
      .sort((a, b) => a.position - b.position);
    // Walk the full column; at each visible slot, drop in the next visible id.
    let vi = 0;
    const mergedIds = colSorted.map((l) =>
      visible.has(l.id) && vi < orderedVisibleIds.length ? orderedVisibleIds[vi++] : l.id
    );
    const posById = new Map(mergedIds.map((id, i) => [id, i]));
    table.set(
      'leads',
      all.map((l) => (posById.has(l.id) ? { ...l, position: posById.get(l.id)! } : l))
    );
  },

  async remove(id: string): Promise<void> {
    await delay();
    table.set('leads', table.get('leads').filter((l) => l.id !== id));
    table.set('comments', table.get('comments').filter((c) => c.leadId !== id));
    // Detach any tasks linked to this lead so they don't keep a dangling leadId.
    // SUPABASE: the FK is declared ON DELETE SET NULL, which does this server-side.
    table.set(
      'tasks',
      table.get('tasks').map((t) => (t.leadId === id ? { ...t, leadId: null } : t))
    );
  },

  // ---- Comments / activity -------------------------------------------------
  /** SUPABASE: supabase.from('comments').select('*').eq('lead_id', id).order('created_at') */
  async comments(leadId: string): Promise<Comment[]> {
    await delay(60);
    return table
      .get('comments')
      .filter((c) => c.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addActivity(
    leadId: string,
    authorId: string,
    type: ActivityType,
    body: string
  ): Promise<Comment> {
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

  async removeComment(id: string): Promise<void> {
    await delay(60);
    table.set('comments', table.get('comments').filter((c) => c.id !== id));
  },
};
