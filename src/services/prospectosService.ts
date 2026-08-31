// ============================================================================
// Minero de Prospectos — servicio dual mock/Supabase (personal del fundador).
// Cada prospecto pertenece a un dueño (owner_id = auth.uid()) → RLS owner-only.
// Es el "delivery" del lead gen: la lista de empresas que Martín está cazando.
// ============================================================================
import type { Prospecto, ProspectoContacto, ProspectoSegment, ProspectoSenales, ProspectoTechnical } from '../types';
import { delay, table } from './db';
import { uid, nowISO } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { computeTemperatura } from '../lib/prospectoUtils';

export interface ProspectoInput {
  id?: string;
  company: string;
  segment: ProspectoSegment;
  city: string;
  pais?: string;
  size?: string;
  senales?: ProspectoSenales;
  website?: string;
  contact?: ProspectoContacto;
  /** 0-100; si viene, se recalcula la temperatura automáticamente. */
  score?: number;
  objetivo?: boolean;
  gap?: string;
  notas?: string;
  technical?: ProspectoTechnical | null;
  source?: 'seed' | 'manual' | 'apify';
}

export interface ProspectosService {
  listFor(ownerId: string): Promise<Prospecto[]>;
  save(ownerId: string, input: ProspectoInput): Promise<Prospecto>;
  remove(id: string): Promise<void>;
  toggleObjetivo(id: string, objetivo: boolean): Promise<Prospecto>;
}

// ---------------------------------------------------------------------------
// Mappers fija ↔ tipo
// ---------------------------------------------------------------------------
type ProspectoRow = {
  id: string;
  owner_id: string;
  company: string;
  segment: ProspectoSegment;
  city: string;
  pais: string | null;
  size: string | null;
  senales: ProspectoSenales | null;
  website: string | null;
  contact: ProspectoContacto | null;
  score: number;
  temperatura: Prospecto['temperatura'];
  objetivo: boolean;
  gap: string | null;
  notas: string | null;
  technical: ProspectoTechnical | null;
  source: Prospecto['source'];
  created_at: string;
  updated_at: string;
};

function rowToProspecto(r: ProspectoRow): Prospecto {
  return {
    id: r.id,
    ownerId: r.owner_id,
    company: r.company,
    segment: r.segment,
    city: r.city,
    pais: r.pais ?? undefined,
    size: r.size ?? undefined,
    senales: r.senales ?? undefined,
    website: r.website ?? undefined,
    contact: r.contact ?? undefined,
    score: r.score,
    temperatura: r.temperatura,
    objetivo: r.objetivo,
    gap: r.gap ?? undefined,
    notas: r.notas ?? undefined,
    technical: r.technical ?? null,
    source: r.source,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Supabase (producción)
// ---------------------------------------------------------------------------
const SUPABASE_PROSPECTOS: ProspectosService = {
  async listFor(ownerId) {
    const { data, error } = await supabase!
      .from('prospectos')
      .select('*')
      .eq('owner_id', ownerId)
      .order('score', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as ProspectoRow[]).map(rowToProspecto);
  },

  async save(ownerId, input) {
    const now = nowISO();
    const score = typeof input.score === 'number' ? input.score : 0;
    const payload = {
      owner_id: ownerId,
      company: input.company,
      segment: input.segment,
      city: input.city,
      pais: input.pais ?? null,
      size: input.size ?? null,
      senales: input.senales ?? null,
      website: input.website ?? null,
      contact: input.contact ?? null,
      score,
      temperatura: computeTemperatura(score),
      objetivo: input.objetivo ?? true,
      gap: input.gap ?? null,
      notas: input.notas ?? null,
      technical: input.technical ?? null,
      source: input.source ?? 'manual',
      updated_at: now,
    };
    const { data, error } = await supabase!
      .from('prospectos')
      .upsert({ id: input.id ?? undefined, ...payload, created_at: now }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return rowToProspecto(data as unknown as ProspectoRow);
  },

  async remove(id) {
    const { error } = await supabase!.from('prospectos').delete().eq('id', id);
    if (error) throw error;
  },

  async toggleObjetivo(id, objetivo) {
    const { data, error } = await supabase!
      .from('prospectos')
      .update({ objetivo, updated_at: nowISO() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToProspecto(data as unknown as ProspectoRow);
  },
};

// ---------------------------------------------------------------------------
// Mock (local dev, sin Supabase)
// ---------------------------------------------------------------------------
const mockProspectos: ProspectosService = {
  async listFor(ownerId) {
    await delay();
    return table
      .get('prospectos')
      .filter((p) => p.ownerId === ownerId)
      .sort((a, b) => b.score - a.score);
  },

  async save(ownerId, input) {
    await delay();
    const rows = table.get('prospectos');
    const now = nowISO();
    const score = typeof input.score === 'number' ? input.score : 0;
    const existing = input.id ? rows.find((r) => r.id === input.id) : undefined;
    const prospecto: Prospecto = {
      id: existing?.id ?? uid('prosp-'),
      ownerId,
      company: input.company,
      segment: input.segment,
      city: input.city,
      pais: input.pais ?? 'Ecuador',
      size: input.size ?? undefined,
      senales: input.senales ?? undefined,
      website: input.website ?? undefined,
      contact: input.contact ?? undefined,
      score,
      temperatura: computeTemperatura(score),
      objetivo: input.objetivo ?? true,
      gap: input.gap ?? undefined,
      notas: input.notas ?? undefined,
      technical: input.technical ?? null,
      source: input.source ?? 'manual',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      const idx = rows.findIndex((r) => r.id === prospecto.id);
      rows[idx] = prospecto;
    } else {
      rows.push(prospecto);
    }
    table.set('prospectos', rows);
    return prospecto;
  },

  async remove(id) {
    await delay();
    table.set('prospectos', table.get('prospectos').filter((p) => p.id !== id));
  },

  async toggleObjetivo(id, objetivo) {
    await delay();
    const rows = table.get('prospectos');
    const idx = rows.findIndex((p) => p.id === id);
    const updated = { ...rows[idx], objetivo, updatedAt: nowISO() };
    rows[idx] = updated;
    table.set('prospectos', rows);
    return updated;
  },
};

export const prospectosService: ProspectosService = supabase
  ? SUPABASE_PROSPECTOS
  : mockProspectos;
