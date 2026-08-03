import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDb, migrateDb } from '../src/db/index.js';
import { leads, profiles, runs } from '../src/db/schema.js';
import { normalizeDomain, normalizePhone } from '../src/lib/normalize.js';
import { dedupeAgainstHistory } from '../src/pipeline/dedupe.js';
import type { SourcedLead } from '../src/pipeline/types.js';

test('normalizeDomain strips www/case/path and rejects social hosts', () => {
  assert.equal(normalizeDomain('https://www.Example.com/about'), 'example.com');
  assert.equal(normalizeDomain('EXAMPLE.COM/services'), 'example.com');
  assert.equal(normalizeDomain('https://www.facebook.com/somebiz'), null);
  assert.equal(normalizeDomain('https://linktr.ee/somebiz'), null);
  assert.equal(normalizeDomain(null), null);
});

test('normalizePhone collides US formats', () => {
  assert.equal(normalizePhone('(713) 555-0101'), '17135550101');
  assert.equal(normalizePhone('+1 713 555 0101'), '17135550101');
  assert.equal(normalizePhone('713.555.0101'), '17135550101');
  assert.equal(normalizePhone('n/a'), null);
});

function makeLead(overrides: Partial<SourcedLead>): SourcedLead {
  return {
    placeId: `pid-${Math.random().toString(36).slice(2)}`,
    name: 'Test Biz',
    ...overrides,
  };
}

test('dedupeAgainstHistory: place_id, domain and phone against history + within batch', () => {
  const db = createDb(':memory:');
  migrateDb(db);

  const [profile] = db
    .insert(profiles)
    .values({ name: 'p', industry: 'x', geos: ['Houston, TX'] })
    .returning()
    .all();
  const [run] = db.insert(runs).values({ profileId: profile!.id }).returning().all();

  // History: one existing lead with known place_id, domain and phone.
  db.insert(leads)
    .values({
      profileId: profile!.id,
      firstRunId: run!.id,
      placeId: 'pid-existing',
      name: 'Existing Biz',
      normalizedDomain: 'known.com',
      normalizedPhone: '17135550101',
      status: 'new',
    })
    .run();

  const incoming: SourcedLead[] = [
    makeLead({ placeId: 'pid-existing', name: 'same place id' }), // dupe by place_id
    makeLead({ websiteUrl: 'https://www.KNOWN.com/x', name: 'same domain' }), // dupe by domain
    makeLead({ phone: '(713) 555-0101', name: 'same phone' }), // dupe by phone
    makeLead({ websiteUrl: 'https://fresh.com', phone: '832 555 0000', name: 'fresh A' }),
    makeLead({ websiteUrl: 'FRESH.COM/about', name: 'in-batch domain dupe' }), // dupe within batch
    makeLead({ websiteUrl: 'https://www.facebook.com/biz', name: 'social only — fresh' }),
  ];

  const { fresh, duplicates } = dedupeAgainstHistory(db, incoming);
  assert.equal(duplicates, 4);
  assert.deepEqual(
    fresh.map((l) => l.name),
    ['fresh A', 'social only — fresh'],
  );
  // Social URL must not produce a domain (two facebook leads are NOT dupes of each other).
  assert.equal(fresh[1]!.normalizedDomain, null);
});
