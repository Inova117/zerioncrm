// ============================================================================
// Actividad diaria del vendedor — servicio dual mock/Supabase.
//
// El vendedor registra QUÉ HIZO (llamadas, contactos, demos, cierres) cada
// día; el admin lo supervisa. Un registro por usuario y día (upsert).
// ============================================================================
import type { DailyActivity } from '../types';
import { delay } from './db';
import { uid, nowISO } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';

export interface DailyActivityInput {
  userId: string;
  /** YYYY-MM-DD */
  day: string;
  calls: number;
  contacts: number;
  demos: number;
  closes: number;
  notes: string;
}

export interface DailyActivityService {
  /** Registros de UN vendedor (rango opcional). */
  listFor(userId: string, from?: string, to?: string): Promise<DailyActivity[]>;
  /** Registros de VARIOS vendedores en un rango (supervisión admin). */
  listRange(userIds: string[], from: string, to: string): Promise<DailyActivity[]>;
  /** Crea o actualiza el registro del día (PK: userId + day). */
  save(input: DailyActivityInput): Promise<DailyActivity>;
}

// ---------------------------------------------------------------------------
// Mappers locales (fila ↔ tipo)
// ---------------------------------------------------------------------------
type ActivityRow = {
  id: string;
  user_id: string;
  day: string;
  calls: number;
  contacts: number;
  demos: number;
  closes: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

function rowToActivity(r: ActivityRow): DailyActivity {
  return {
    id: r.id,
    userId: r.user_id,
    day: String(r.day).slice(0, 10), // el date de Supabase llega como 'YYYY-MM-DD'
    calls: r.calls ?? 0,
    contacts: r.contacts ?? 0,
    demos: r.demos ?? 0,
    closes: r.closes ?? 0,
    notes: r.notes ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const clamp = (n: number): number => Math.max(0, Math.round(n) || 0);

// ---------------------------------------------------------------------------
// Supabase implementation (production)
// ---------------------------------------------------------------------------
const supabaseDailyActivity: DailyActivityService = {
  async listFor(userId, from, to) {
    let q = supabase!.from('daily_activity').select('*').eq('user_id', userId);
    if (from) q = q.gte('day', from);
    if (to) q = q.lte('day', to);
    const { data, error } = await q.order('day');
    if (error) throw error;
    return ((data ?? []) as unknown as ActivityRow[]).map(rowToActivity);
  },

  async listRange(userIds, from, to) {
    if (userIds.length === 0) return [];
    const { data, error } = await supabase!
      .from('daily_activity')
      .select('*')
      .in('user_id', userIds)
      .gte('day', from)
      .lte('day', to)
      .order('day');
    if (error) throw error;
    return ((data ?? []) as unknown as ActivityRow[]).map(rowToActivity);
  },

  async save(input) {
    const { data, error } = await supabase!
      .from('daily_activity')
      .upsert(
        {
          user_id: input.userId,
          day: input.day,
          calls: clamp(input.calls),
          contacts: clamp(input.contacts),
          demos: clamp(input.demos),
          closes: clamp(input.closes),
          notes: input.notes.trim().slice(0, 2000),
          updated_at: nowISO(),
        },
        { onConflict: 'user_id,day' }
      )
      .select()
      .single();
    if (error) throw error;
    return rowToActivity(data as unknown as ActivityRow);
  },
};

// ---------------------------------------------------------------------------
// Mock implementation (local dev, sin Supabase)
// ---------------------------------------------------------------------------
const MOCK_KEY = 'zerioncrm:v1:dailyActivity';

function mockRows(): DailyActivity[] {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as DailyActivity[]) : [];
  } catch {
    return [];
  }
}

function mockWrite(rows: DailyActivity[]): void {
  localStorage.setItem(MOCK_KEY, JSON.stringify(rows));
}

const mockDailyActivity: DailyActivityService = {
  async listFor(userId, from, to) {
    await delay();
    return mockRows()
      .filter((r) => r.userId === userId && (!from || r.day >= from) && (!to || r.day <= to))
      .sort((a, b) => a.day.localeCompare(b.day));
  },

  async listRange(userIds, from, to) {
    await delay();
    return mockRows()
      .filter((r) => userIds.includes(r.userId) && r.day >= from && r.day <= to)
      .sort((a, b) => a.day.localeCompare(b.day));
  },

  async save(input) {
    await delay();
    const rows = mockRows();
    const idx = rows.findIndex((r) => r.userId === input.userId && r.day === input.day);
    const existing = idx >= 0 ? rows[idx] : null;
    const now = nowISO();
    const row: DailyActivity = {
      id: existing?.id ?? uid('act-'),
      userId: input.userId,
      day: input.day,
      calls: clamp(input.calls),
      contacts: clamp(input.contacts),
      demos: clamp(input.demos),
      closes: clamp(input.closes),
      notes: input.notes.trim().slice(0, 2000),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    mockWrite(rows);
    return row;
  },
};

export const dailyActivityService: DailyActivityService = supabase
  ? supabaseDailyActivity
  : mockDailyActivity;
