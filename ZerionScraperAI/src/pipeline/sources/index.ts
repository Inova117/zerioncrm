import { env } from '../../lib/env.js';
import type { LeadSource } from '../types.js';
import { ApifySource } from './apify.js';
import { FixtureSource } from './fixture.js';

export function createLeadSource(): LeadSource {
  switch (env.LEAD_SOURCE) {
    case 'fixture':
      return new FixtureSource(env.FIXTURE_PATH);
    case 'apify':
      return new ApifySource();
  }
}
