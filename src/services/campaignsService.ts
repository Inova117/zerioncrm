// ============================================================================
// campaignsService — prospección automática diaria (campañas configurables).
// CRUD dual (mock/Supabase) de la tabla prospecting_campaigns. El scheduler
// (Fase 4) ejecuta las campañas `active` cada mañana.
// ============================================================================
import { supabase } from '../lib/supabaseClient';
import { table, delay } from './db';
import { rowToCampaign, campaignToRow } from './mappers';
import type { ProspectingCampaign } from '../types';
import { uid } from '../lib/utils';

// --- Supabase ----------------------------------------------------------------
async function supabaseListCampaigns(): Promise<ProspectingCampaign[]> {
  const { data, error } = await supabase!
    .from('prospecting_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToCampaign);
}

async function supabaseSaveCampaign(c: ProspectingCampaign): Promise<ProspectingCampaign> {
  const row = campaignToRow(c);
  if (c.id) {
    const { data, error } = await supabase!
      .from('prospecting_campaigns')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', c.id)
      .select()
      .single();
    if (error) throw error;
    return rowToCampaign(data);
  }
  const { data, error } = await supabase!
    .from('prospecting_campaigns')
    .insert({ ...row, owner_id: c.ownerId })
    .select()
    .single();
  if (error) throw error;
  return rowToCampaign(data);
}

async function supabaseDeleteCampaign(id: string): Promise<void> {
  const { error } = await supabase!.from('prospecting_campaigns').delete().eq('id', id);
  if (error) throw error;
}

// --- Mock --------------------------------------------------------------------
async function mockListCampaigns(): Promise<ProspectingCampaign[]> {
  await delay();
  return [...(table.get('campaigns') as ProspectingCampaign[])].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

async function mockSaveCampaign(c: ProspectingCampaign): Promise<ProspectingCampaign> {
  await delay();
  const all = table.get('campaigns') as ProspectingCampaign[];
  const now = new Date().toISOString();
  const existing = c.id ? all.find((x) => x.id === c.id) : undefined;
  const saved: ProspectingCampaign = existing
    ? { ...existing, ...c, updatedAt: now }
    : { ...c, id: c.id || uid('camp-'), createdAt: now, updatedAt: now };
  const next = existing ? all.map((x) => (x.id === saved.id ? saved : x)) : [...all, saved];
  table.set('campaigns', next);
  return saved;
}

async function mockDeleteCampaign(id: string): Promise<void> {
  await delay();
  table.set(
    'campaigns',
    (table.get('campaigns') as ProspectingCampaign[]).filter((c) => c.id !== id)
  );
}

export const listCampaigns = supabase ? supabaseListCampaigns : mockListCampaigns;
export const saveCampaign = supabase ? supabaseSaveCampaign : mockSaveCampaign;
export const deleteCampaign = supabase ? supabaseDeleteCampaign : mockDeleteCampaign;
