import { readFileSync } from 'node:fs';
import type { FetchResult, LeadSource, Profile, SourcedLead } from '../types.js';

/** Local-testing source: reads leads from a JSON file (see test/fixtures). */
export class FixtureSource implements LeadSource {
  readonly name = 'fixture';

  constructor(private readonly path: string) {}

  async fetch(_profile: Profile, limit: number): Promise<FetchResult> {
    const all = JSON.parse(readFileSync(this.path, 'utf8')) as SourcedLead[];
    return { leads: all.slice(0, limit), costUsd: 0, provider: this.name };
  }
}
