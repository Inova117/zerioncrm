// ============================================================================
// decisionsService — lee el log de decisiones del sistema autónomo de
// prospección (tabla prospecting_decisions). Solo lectura; lo escribe la edge
// function run-campaign (service_role).
// ============================================================================
import { supabase } from '../lib/supabaseClient';
import { table, delay } from './db';
import { rowToDecision } from './mappers';
import type { DecisionRecord } from '../types';

async function supaListDecisions(limit = 10): Promise<DecisionRecord[]> {
  const { data, error } = await supabase!
    .from('prospecting_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToDecision);
}

async function mockListDecisions(limit = 10): Promise<DecisionRecord[]> {
  await delay();
  const all = table.get('decisions') as DecisionRecord[];
  return all.slice(0, limit);
}

export const listDecisions = supabase ? supaListDecisions : mockListDecisions;