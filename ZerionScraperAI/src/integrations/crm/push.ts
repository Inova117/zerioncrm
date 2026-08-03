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

/** Normalized set of every phone already present in the CRM (dedupe key). */
async function loadCrmPhones(crm: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await crm.from('leads').select('phone');
  if (error) throw new Error(`No pude leer leads del CRM para deduplicar: ${error.message}`);
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const key = normalizePhone((row as { phone: string | null }).phone);
    if (key) seen.add(key);
  }
  return seen;
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

  const seenPhones = await loadCrmPhones(crm);
  let position = await nextPosition(crm, assignee.id);

  for (const lead of candidates) {
    const key = crmPhoneKey(lead);
    if (key && seenPhones.has(key)) {
      summary.duplicates++;
      recordPush(db, lead.id, 'skipped', null, 'duplicado en el CRM (mismo teléfono)');
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
    if (key) seenPhones.add(key);
    recordPush(db, lead.id, 'pushed', String((data as { id: string }).id), null);
  }

  return summary;
}
