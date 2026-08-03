// ---------------------------------------------------------------------------
// Push scraper leads into the Zerion CRM (Supabase) as prospectos.
//
// Flow: pick this profile's workable, not-yet-pushed leads → dedupe by phone
// against what's already in the CRM → insert each as a "nuevo" prospecto
// assigned to the configured Staff user (René) → log the push locally so a
// re-run never double-inserts. Cold-callable the moment a run finishes.
// ---------------------------------------------------------------------------
import { and, eq, inArray } from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '../../db/index.js';
import { leads as leadsTable, pushes } from '../../db/schema.js';
import { env } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { normalizePhone } from '../../lib/normalize.js';
import type { Profile } from '../../pipeline/types.js';
import { getCrmClient } from './client.js';
import { crmPhoneKey, leadToCrmRow } from './map.js';

// Statuses we never send to the CRM: hard failures and email-campaign
// terminals (the V3 pivot is cold-call-first, so these don't apply here).
const EXCLUDED_STATUSES = new Set([
  'error',
  'disqualified',
  'unsubscribed',
  'bounced',
  'replied',
]);

export interface CrmPushSummary {
  profile: string;
  assignee: string;
  candidates: number;
  pushed: number;
  duplicates: number;
  alreadyPushed: number;
  failed: number;
}

interface Assignee {
  id: string;
  name: string;
}

/** Resolve the Staff user who receives the leads, by email, in the CRM. */
async function resolveAssignee(crm: SupabaseClient): Promise<Assignee> {
  const email = env.CRM_ASSIGN_TO_EMAIL;
  if (!email) throw new Error('Falta CRM_ASSIGN_TO_EMAIL en .env');

  const { data, error } = await crm
    .from('profiles')
    .select('id, name, active')
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(`No pude consultar el usuario del CRM: ${error.message}`);
  if (!data) {
    throw new Error(
      `No existe un usuario con correo ${email} en el CRM. Créalo primero en Equipo (Staff).`,
    );
  }
  if (!data.active) logger.warn({ email }, 'el usuario del CRM está inactivo');
  return { id: data.id as string, name: data.name as string };
}

/** PostgREST caps rows at 1000 by default; page past it so dedupe sees the whole table. */
const PAGE_SIZE = 1000;

export async function fetchAllPages(
  crm: SupabaseClient,
  table: 'leads' | 'lead_discoveries',
  columns: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await crm.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`No pude leer ${table} para deduplicar: ${error.message}`);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** Every dedupe key already present in the CRM, from both ingestion paths. */
export interface CrmDedupeKeys {
  /** phones of existing prospectos (public.leads). */
  phones: Set<string>;
  /** place_id of existing prospectos (leads.enrichment->>placeId). */
  placeIds: Set<string>;
  /** place_id of the Lead Finder inbox (public.lead_discoveries). */
  discoveryIds: Set<string>;
  /** phones of the Lead Finder inbox (public.lead_discoveries). */
  discoveryPhones: Set<string>;
}

/**
 * Load the CRM-side dedupe keys: prospect phones/place_ids plus the Lead
 * Finder inbox. Crossing both ingestion paths means a business the app already
 * discovered can't be re-inserted as a fresh prospecto by this pipeline.
 */
async function loadCrmDedupeKeys(crm: SupabaseClient): Promise<CrmDedupeKeys> {
  const leadRows = await fetchAllPages(crm, 'leads', 'phone,enrichment');
  const discoveryRows = await fetchAllPages(crm, 'lead_discoveries', 'place_id,phone');

  const phones = new Set<string>();
  const placeIds = new Set<string>();
  for (const row of leadRows) {
    const key = normalizePhone((row as { phone?: string | null }).phone);
    if (key) phones.add(key);
    const pid = ((row as { enrichment?: unknown }).enrichment as { placeId?: string } | null)?.placeId;
    if (pid) placeIds.add(pid);
  }

  const discoveryIds = new Set<string>();
  const discoveryPhones = new Set<string>();
  for (const row of discoveryRows) {
    const pid = (row as { place_id?: string | null }).place_id;
    if (pid) discoveryIds.add(pid);
    const pk = normalizePhone((row as { phone?: string | null }).phone);
    if (pk) discoveryPhones.add(pk);
  }

  return { phones, placeIds, discoveryIds, discoveryPhones };
}

/**
 * Cross-CRM dedupe decision. A lead is a duplicate when its place_id or phone
 * already exist as a prospecto (leads) or in the Lead Finder inbox
 * (lead_discoveries). Pure — unit-tested without a network.
 */
export function isCrmDuplicate(
  placeId: string | null,
  phoneKey: string | null,
  keys: CrmDedupeKeys,
): boolean {
  if (placeId && keys.placeIds.has(placeId)) return true;
  if (placeId && keys.discoveryIds.has(placeId)) return true;
  if (phoneKey && keys.phones.has(phoneKey)) return true;
  if (phoneKey && keys.discoveryPhones.has(phoneKey)) return true;
  return false;
}

/** Next free Kanban position at the top of the assignee's "nuevo" column. */
async function nextPosition(crm: SupabaseClient, assigneeId: string): Promise<number> {
  const { data } = await crm
    .from('leads')
    .select('position')
    .eq('assigned_to', assigneeId)
    .eq('temperature', 'nuevo')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { position: number } | null)?.position ?? -1) + 1;
}

function recordPush(
  db: Db,
  leadId: number,
  status: 'pushed' | 'skipped' | 'failed',
  crmLeadId: string | null,
  error: string | null,
): void {
  db.insert(pushes)
    .values({ leadId, method: 'crm', status, campaignId: 'crm', instantlyLeadId: crmLeadId, error })
    .run();
}

export async function pushLeadsToCrm(db: Db, profile: Profile): Promise<CrmPushSummary> {
  const crm = getCrmClient();
  const assignee = await resolveAssignee(crm);

  // Leads already handled for the CRM (pushed or skipped-as-dupe) — idempotency.
  const handledRows = db
    .select({ leadId: pushes.leadId })
    .from(pushes)
    .where(and(eq(pushes.method, 'crm'), inArray(pushes.status, ['pushed', 'skipped'])))
    .all();
  const handled = new Set(handledRows.map((r) => r.leadId));

  const all = db.select().from(leadsTable).where(eq(leadsTable.profileId, profile.id)).all();
  const candidates = all.filter((l) => !EXCLUDED_STATUSES.has(l.status) && !handled.has(l.id));
  const alreadyPushed = all.filter(
    (l) => !EXCLUDED_STATUSES.has(l.status) && handled.has(l.id),
  ).length;

  const summary: CrmPushSummary = {
    profile: profile.name,
    assignee: assignee.name,
    candidates: candidates.length,
    pushed: 0,
    duplicates: 0,
    alreadyPushed,
    failed: 0,
  };

  if (!candidates.length) return summary;

  const keys = await loadCrmDedupeKeys(crm);
  let position = await nextPosition(crm, assignee.id);

  for (const lead of candidates) {
    const key = crmPhoneKey(lead);
    if (isCrmDuplicate(lead.placeId ?? null, key, keys)) {
      summary.duplicates++;
      recordPush(db, lead.id, 'skipped', null, 'duplicado en el CRM (place_id o teléfono)');
      continue;
    }

    const row = leadToCrmRow(lead, profile, { assignedTo: assignee.id, position });
    const { data, error } = await crm.from('leads').insert(row).select('id').single();

    if (error || !data) {
      summary.failed++;
      logger.error({ lead: lead.name, error: error?.message }, 'inserción en el CRM falló');
      recordPush(db, lead.id, 'failed', null, error?.message ?? 'error desconocido');
      continue;
    }

    summary.pushed++;
    position++;
    if (lead.placeId) keys.placeIds.add(lead.placeId);
    if (key) keys.phones.add(key);
    recordPush(db, lead.id, 'pushed', String((data as { id: string }).id), null);
  }

  return summary;
}
