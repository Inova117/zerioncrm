import type {
  CashMove,
  RoadmapActivity,
  RoadmapActivityStatus,
  RoadmapClient,
  RoadmapDay,
  RoadmapDoc,
  RoadmapMeta,
} from '../types';
import { table, delay } from './db';
import { uid } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import {
  cashMoveToRow,
  roadmapClientToRow,
  roadmapDayToRow,
  rowToCashMove,
  rowToRoadmapActivity,
  rowToRoadmapClient,
  rowToRoadmapDay,
} from './mappers';
import { SEED_VERSION, defaultActivities, defaultDays, defaultMeta } from '../data/roadmapDefaults';

// ============================================================================
// Roadmap Zerion (Guía Diaria V1) — servicio dual mock/Supabase.
// El módulo es personal del owner (admin 117mgd…): todas las tablas filtran
// por owner_id = auth.uid() vía RLS; el auto-siembra pobla el diario vacío
// con el plan del Excel (82 días) la primera vez que se abre.
// ============================================================================

export interface RoadmapService {
  load(): Promise<RoadmapDoc>;
  saveDay(day: RoadmapDay): Promise<void>;
  setActivityStatus(id: string, status: RoadmapActivityStatus): Promise<void>;
  createClient(input: Omit<RoadmapClient, 'id'>): Promise<RoadmapClient>;
  updateClient(id: string, patch: Partial<RoadmapClient>): Promise<void>;
  removeClient(id: string): Promise<void>;
  addCash(input: Omit<CashMove, 'id'>): Promise<CashMove>;
  removeCash(id: string): Promise<void>;
  saveMeta(meta: RoadmapMeta): Promise<void>;
}

// ---------------------------------------------------------------------------
// Supabase implementation (production)
// ---------------------------------------------------------------------------
async function ownerId(): Promise<string | null> {
  const { data } = await supabase!.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Fila de roadmap_activities lista para insert (columnas snake_case). */
const activityRow = (owner: string, a: RoadmapActivity) => ({
  owner_id: owner,
  week: a.week,
  phase: a.phase,
  title: a.title,
  responsible: a.responsible,
  due_date: a.dueDate,
  status: a.status,
  is_gate: a.isGate,
  sort: a.sort,
  hours: a.hours,
  reparto: a.reparto,
});

const supabaseRoadmapService: RoadmapService = {
  async load() {
    const owner = await ownerId();
    if (!owner) throw new Error('Sin sesión activa');
    const [daysRes, actsRes, clientsRes, cashRes, metaRes] = await Promise.all([
      supabase!.from('roadmap_days').select('*').eq('owner_id', owner).order('day'),
      supabase!.from('roadmap_activities').select('*').eq('owner_id', owner).order('sort'),
      supabase!.from('roadmap_clients').select('*').eq('owner_id', owner).order('created_at'),
      supabase!.from('roadmap_cash').select('*').eq('owner_id', owner).order('day', { ascending: false }),
      supabase!.from('roadmap_meta').select('data').eq('owner_id', owner).maybeSingle(),
    ]);
    for (const r of [daysRes, actsRes, clientsRes, cashRes, metaRes]) {
      if (r.error) throw r.error;
    }

    let days = (daysRes.data ?? []).map(rowToRoadmapDay);
    let activities = (actsRes.data ?? []).map(rowToRoadmapActivity);
    const clients = (clientsRes.data ?? []).map(rowToRoadmapClient);
    const cash = (cashRes.data ?? []).map(rowToCashMove);
    let meta: RoadmapMeta | null = metaRes.data ? (metaRes.data.data as RoadmapMeta) : null;

    // Auto-siembra en el primer acceso: diario vacío → plan del Excel completo.
    if (days.length === 0) {
      const seedDays = defaultDays();
      const { error } = await supabase!
        .from('roadmap_days')
        .upsert(seedDays.map((day) => ({ ...roadmapDayToRow(day), owner_id: owner })));
      if (error) throw error;
      days = seedDays;
    }
    if (activities.length === 0) {
      const { data, error } = await supabase!
        .from('roadmap_activities')
        .insert(defaultActivities().map((a) => activityRow(owner, a)))
        .select();
      if (error) throw error;
      activities = (data ?? []).map(rowToRoadmapActivity);
    }
    if (!meta) {
      meta = defaultMeta();
      const { error } = await supabase!
        .from('roadmap_meta')
        .upsert({ owner_id: owner, data: meta }, { onConflict: 'owner_id' });
      if (error) throw error;
    }

    // Auto-migración de contenido: si la semilla es más nueva que la guardada,
    // re-siembra actividades + metas mensuales (preserva diario y finanzas).
    if ((meta.seedVersion ?? 1) < SEED_VERSION) {
      const { error: dErr } = await supabase!
        .from('roadmap_activities')
        .delete()
        .eq('owner_id', owner);
      if (dErr) throw dErr;
      const { data, error } = await supabase!
        .from('roadmap_activities')
        .insert(defaultActivities().map((a) => activityRow(owner, a)))
        .select();
      if (error) throw error;
      activities = (data ?? []).map(rowToRoadmapActivity);
      meta = { ...meta, monthlyGoals: defaultMeta().monthlyGoals, seedVersion: SEED_VERSION };
      const { error: mErr } = await supabase!
        .from('roadmap_meta')
        .upsert({ owner_id: owner, data: meta }, { onConflict: 'owner_id' });
      if (mErr) throw mErr;
    }

    return { meta, days, activities, clients, cash };
  },

  async saveDay(day) {
    const owner = await ownerId();
    if (!owner) throw new Error('Sin sesión activa');
    const { error } = await supabase!
      .from('roadmap_days')
      .upsert({ ...roadmapDayToRow(day), owner_id: owner }, { onConflict: 'owner_id,day' });
    if (error) throw error;
  },

  async setActivityStatus(id, status) {
    const { error } = await supabase!.from('roadmap_activities').update({ status }).eq('id', id);
    if (error) throw error;
  },

  async createClient(input) {
    const owner = await ownerId();
    if (!owner) throw new Error('Sin sesión activa');
    const { data, error } = await supabase!
      .from('roadmap_clients')
      .insert({ ...roadmapClientToRow(input), owner_id: owner })
      .select()
      .single();
    if (error) throw error;
    return rowToRoadmapClient(data);
  },

  async updateClient(id, patch) {
    const { error } = await supabase!.from('roadmap_clients').update(roadmapClientToRow(patch)).eq('id', id);
    if (error) throw error;
  },

  async removeClient(id) {
    const { error } = await supabase!.from('roadmap_clients').delete().eq('id', id);
    if (error) throw error;
  },

  async addCash(input) {
    const owner = await ownerId();
    if (!owner) throw new Error('Sin sesión activa');
    const { data, error } = await supabase!
      .from('roadmap_cash')
      .insert({ ...cashMoveToRow(input), owner_id: owner })
      .select()
      .single();
    if (error) throw error;
    return rowToCashMove(data);
  },

  async removeCash(id) {
    const { error } = await supabase!.from('roadmap_cash').delete().eq('id', id);
    if (error) throw error;
  },

  async saveMeta(meta) {
    const owner = await ownerId();
    if (!owner) throw new Error('Sin sesión activa');
    const { error } = await supabase!
      .from('roadmap_meta')
      .upsert({ owner_id: owner, data: meta }, { onConflict: 'owner_id' });
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Mock implementation (local dev, sin Supabase)
// ---------------------------------------------------------------------------
const mockRoadmapService: RoadmapService = {
  async load() {
    await delay();
    let days = table.get('roadmapDays');
    let activities = table.get('roadmapActivities');
    let meta = table.get('roadmapMeta')[0] ?? null;
    const clients = table.get('roadmapClients');
    const cash = table.get('roadmapCash');
    // Auto-siembra para localStorage ya "seeded" de antes (misma lógica que Supabase).
    if (days.length === 0) {
      days = defaultDays();
      table.set('roadmapDays', days);
    }
    if (activities.length === 0) {
      activities = defaultActivities();
      table.set('roadmapActivities', activities);
    }
    if (!meta) {
      meta = defaultMeta();
      table.set('roadmapMeta', [meta]);
    }
    // Auto-migración de contenido (misma lógica que Supabase).
    if ((meta.seedVersion ?? 1) < SEED_VERSION) {
      activities = defaultActivities();
      table.set('roadmapActivities', activities);
      meta = { ...meta, monthlyGoals: defaultMeta().monthlyGoals, seedVersion: SEED_VERSION };
      table.set('roadmapMeta', [meta]);
    }
    return { meta, days, activities, clients, cash };
  },

  async saveDay(day) {
    await delay(60);
    const days = table.get('roadmapDays');
    const exists = days.some((d) => d.day === day.day);
    table.set(
      'roadmapDays',
      exists ? days.map((d) => (d.day === day.day ? day : d)) : [...days, day]
    );
  },

  async setActivityStatus(id, status) {
    await delay(60);
    table.set(
      'roadmapActivities',
      table.get('roadmapActivities').map((a) => (a.id === id ? { ...a, status } : a))
    );
  },

  async createClient(input) {
    await delay();
    const client: RoadmapClient = { ...input, id: uid('rc-') };
    table.set('roadmapClients', [...table.get('roadmapClients'), client]);
    return client;
  },

  async updateClient(id, patch) {
    await delay();
    table.set(
      'roadmapClients',
      table.get('roadmapClients').map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  },

  async removeClient(id) {
    await delay();
    table.set('roadmapClients', table.get('roadmapClients').filter((c) => c.id !== id));
  },

  async addCash(input) {
    await delay();
    const move: CashMove = { ...input, id: uid('cash-') };
    table.set('roadmapCash', [move, ...table.get('roadmapCash')]);
    return move;
  },

  async removeCash(id) {
    await delay();
    table.set('roadmapCash', table.get('roadmapCash').filter((m) => m.id !== id));
  },

  async saveMeta(meta) {
    await delay(60);
    table.set('roadmapMeta', [meta]);
  },
};

export const roadmapService: RoadmapService = supabase ? supabaseRoadmapService : mockRoadmapService;
