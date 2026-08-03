import type { Db } from '../db/index.js';
import { costs } from '../db/schema.js';

export interface CostEntry {
  runId?: number;
  leadId?: number;
  stage: string;
  provider: string;
  amountUsd: number;
  meta?: Record<string, unknown>;
}

/** NFR: per-lead cost tracking built in — every paid call records its cost. */
export function recordCost(db: Db, entry: CostEntry): void {
  db.insert(costs)
    .values({
      runId: entry.runId ?? null,
      leadId: entry.leadId ?? null,
      stage: entry.stage,
      provider: entry.provider,
      amountUsd: entry.amountUsd,
      meta: entry.meta ?? null,
    })
    .run();
}
