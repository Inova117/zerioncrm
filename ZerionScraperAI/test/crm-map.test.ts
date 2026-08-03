import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lead, Profile } from '../src/pipeline/types.js';
import { buildReason, crmPhoneKey, leadToCrmRow } from '../src/integrations/crm/map.js';

const profile: Profile = {
  id: 1,
  name: 'houston-gc',
  industry: 'general contractor',
  geos: ['Houston, TX'],
  language: 'auto',
  filters: {},
  leadsPerDay: 50,
  instantlyCampaignId: null,
  active: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as unknown as Profile;

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 10,
    profileId: 1,
    firstRunId: 7,
    placeId: 'ChIJfixture0000000000000002',
    name: 'Hernandez Concrete & Paving',
    category: 'Concrete contractor',
    address: '8811 Airline Dr, Houston, TX 77037',
    city: 'Houston',
    phone: '+1 832 555 0144',
    normalizedPhone: '18325550144',
    websiteUrl: null,
    normalizedDomain: null,
    googleRating: 4.9,
    reviewCount: 112,
    language: 'es',
    whatTheyDo: 'Concrete driveways, foundations and paving for homes',
    decisionMakerName: null,
    socialLinks: null,
    whatsappPhone: null,
    segment: 'no_website',
    status: 'segmented',
    score: 82,
    scoreReasons: [{ reason: 'sin sitio web', points: 40 }],
    errorMessage: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as unknown as Lead;
}

test('leadToCrmRow maps the core cold-call fields', () => {
  const row = leadToCrmRow(makeLead(), profile, { assignedTo: 'uuid-rene', position: 3 });
  assert.equal(row.company, 'Hernandez Concrete & Paving');
  assert.equal(row.phone, '+1 832 555 0144');
  assert.equal(row.industry, 'Concrete contractor');
  assert.equal(row.source, 'scraper');
  assert.equal(row.temperature, 'nuevo');
  assert.equal(row.assigned_to, 'uuid-rene');
  assert.equal(row.position, 3);
  assert.equal(row.channel, 'Scraper · houston-gc · run #7');
  // no_website → web opportunity
  assert.equal(row.service, 'web');
  // enrichment carries the structured extras for the Lead Finder cards
  assert.equal(row.enrichment.rating, 4.9);
  assert.equal(row.enrichment.reviewCount, 112);
  assert.equal(row.enrichment.city, 'Houston');
  assert.equal(row.enrichment.segment, 'no_website');
  assert.equal(row.enrichment.score, 82);
  assert.ok(!('whatsapp' in row.enrichment)); // absent → never written as undefined
});

test('buildReason packs rating, segment and pain context', () => {
  const reason = buildReason(makeLead());
  assert.match(reason, /Concrete contractor · Houston/);
  assert.match(reason, /⭐ 4\.9 \(112 reseñas\)/);
  assert.match(reason, /Sin sitio web/);
  assert.match(reason, /Qué hacen: Concrete driveways/);
  assert.match(reason, /Score 82 · sin sitio web/);
});

test('phone falls back to whatsapp and industry to the profile', () => {
  const row = leadToCrmRow(
    makeLead({ phone: null, whatsappPhone: '+1 832 555 9999', category: null }),
    profile,
    { assignedTo: 'x', position: 0 },
  );
  assert.equal(row.phone, '+1 832 555 9999');
  assert.equal(row.industry, 'general contractor'); // profile.industry fallback
});

test('crmPhoneKey prefers the normalized column', () => {
  assert.equal(crmPhoneKey(makeLead()), '18325550144');
  assert.equal(crmPhoneKey(makeLead({ normalizedPhone: null, phone: '(832) 555-0144' })), '18325550144');
});

test('has_website segment maps to a non-web service and label', () => {
  const row = leadToCrmRow(
    makeLead({ segment: 'has_website', websiteUrl: 'https://hernandezconcrete.com' }),
    profile,
    { assignedTo: 'x', position: 0 },
  );
  assert.equal(row.service, 'otro');
  assert.equal(row.website, 'https://hernandezconcrete.com');
  assert.match(row.reason, /Con sitio web/);
});
