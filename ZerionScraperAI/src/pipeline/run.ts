import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { leads, runs } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { ingest } from './stages/ingest.js';
import { segmentStage } from './stages/segment.js';
import { triageStage } from './stages/triage.js';
import type { LeadSource, LeadStage, Profile } from './types.js';

/**
 * Stage registry, executed in order. V3 flow:
 *   new → segmented → audited → scored → ready
 * ('enriched' is unused since the V3 pivot dropped the email waterfall.)
 * Days 5-7 register: deep audit (PSI+screenshot), pain/score, call card.
 * Leads with no registered next stage simply rest at their status —
 * re-running is always safe (idempotency by status).
 */
export const LEAD_STAGES: LeadStage[] = [segmentStage, triageStage];

export interface RunSummary {
  runId: number;
  fetched: number;
  inserted: number;
  duplicates: number;
  processed: Record<string, number>;
  errors: number;
}

export async function runPipeline(db: Db, source: LeadSource, profile: Profile): Promise<RunSummary> {
  const [run] = db
    .insert(runs)
    .values({ profileId: profile.id, leadsRequested: profile.leadsPerDay })
    .returning({ id: runs.id })
    .all();
  if (!run) throw new Error('failed to create run row');

  const summary: RunSummary = {
    runId: run.id,
    fetched: 0,
    inserted: 0,
    duplicates: 0,
    processed: {},
    errors: 0,
  };

  try {
    // Stage 0 — ingest (run-level)
    const ingestResult = await ingest(db, source, profile, run.id);
    summary.fetched = ingestResult.fetched;
    summary.inserted = ingestResult.inserted;
    summary.duplicates = ingestResult.duplicates;

    // Per-lead stages — process every lead of this profile sitting at each
    // stage's `from` status (including stragglers from previous runs).
    for (const stage of LEAD_STAGES) {
      const pending = db
        .select()
        .from(leads)
        .where(and(eq(leads.profileId, profile.id), eq(leads.status, stage.from)))
        .all();

      let ok = 0;
      for (const lead of pending) {
        try {
          const updates = await stage.handler(db, lead, { runId: run.id, profile });
          db.update(leads)
            .set({ ...updates, status: stage.to, updatedAt: new Date() })
            .where(eq(leads.id, lead.id))
            .run();
          ok++;
        } catch (error) {
          summary.errors++;
          logger.error({ stage: stage.name, leadId: lead.id, error: String(error) }, 'lead failed');
          db.update(leads)
            .set({ status: 'error', errorMessage: String(error), updatedAt: new Date() })
            .where(eq(leads.id, lead.id))
            .run();
        }
      }
      summary.processed[stage.name] = ok;
    }

    db.update(runs)
      .set({
        status: 'done',
        leadsFetched: summary.fetched,
        leadsNew: summary.inserted,
        finishedAt: new Date(),
      })
      .where(eq(runs.id, run.id))
      .run();
  } catch (error) {
    logger.error({ runId: run.id, error: String(error) }, 'run failed');
    db.update(runs)
      .set({ status: 'failed', error: String(error), finishedAt: new Date() })
      .where(eq(runs.id, run.id))
      .run();
    throw error;
  }

  return summary;
}
