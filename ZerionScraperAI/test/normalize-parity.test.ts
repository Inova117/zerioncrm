import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as local from '../src/lib/normalize.js';
import * as shared from '../../supabase/functions/_shared/normalize';

// R2: the normalize logic exists twice — the pipeline's src/lib/normalize.ts
// and the Supabase edge-function copy at supabase/functions/_shared/normalize.ts
// (imported by find-leads). They must produce IDENTICAL outputs: the two
// ingestion paths dedupe against the same CRM tables, so a divergence here
// silently creates duplicate prospectos. Change one → change both.

const PHONES = [
  '(713) 555-0101',
  '+1 713 555 0101',
  '713.555.0101',
  '593 99 123 4567', // Ecuador, 12 digits — no US prefix added
  '1234567', // 7 digits — kept
  '123456', // 6 digits — too short
  'n/a',
  '1-800-FLOWERS',
  'whatsapp:+593991234567',
  '',
  null,
  undefined,
];

const URLS = [
  'https://www.Example.com/about',
  'EXAMPLE.COM/services',
  'https://www.facebook.com/somebiz',
  'https://m.facebook.com/y',
  'https://linktr.ee/somebiz',
  'http://wa.me/123',
  'https://sub.facebook.com/evil',
  'https://notfacebook.com/x',
  'https://sub.domain.com.ec/x',
  'example.com',
  'https://google.com',
  'https://www.youtube.com/watch?v=x',
  null,
  undefined,
];

test('parity: normalizePhone identical outputs', () => {
  for (const input of PHONES) {
    assert.equal(
      shared.normalizePhone(input),
      local.normalizePhone(input),
      `normalizePhone diverged for ${JSON.stringify(input)}`,
    );
  }
});

test('parity: normalizeDomain identical outputs', () => {
  for (const input of URLS) {
    assert.equal(
      shared.normalizeDomain(input),
      local.normalizeDomain(input),
      `normalizeDomain diverged for ${JSON.stringify(input)}`,
    );
  }
});

test('parity: isSocialUrl identical outputs', () => {
  for (const input of URLS) {
    assert.equal(
      shared.isSocialUrl(input as string),
      local.isSocialUrl(input as string),
      `isSocialUrl diverged for ${JSON.stringify(input)}`,
    );
  }
});
