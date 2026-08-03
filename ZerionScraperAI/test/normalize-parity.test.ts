import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import * as local from '../src/lib/normalize.js';
import * as shared from '../../supabase/functions/_shared/normalize';

// R2: the normalize logic exists in THREE places that must stay identical:
//   1. the pipeline's src/lib/normalize.ts            (ingesta masiva local)
//   2. supabase/functions/_shared/normalize.ts        (canónico para edge fns)
//   3. the inline block inside find-leads/index.ts    (autocontenido para
//      deploy por dashboard — el bundler web no incluye _shared)
// The two ingestion paths dedupe against the same CRM tables, so a divergence
// silently creates duplicate prospectos. Change one → change ALL three, or
// this test fails. The inline block is extracted between the
// "normalize-inline-begin" / "normalize-inline-end" markers.

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

const INDEX_PATH = fileURLToPath(
  new URL('../../supabase/functions/find-leads/index.ts', import.meta.url),
);

/** Evaluate the inline normalize block of find-leads/index.ts as plain JS. */
function inlineNormalize() {
  const src = readFileSync(INDEX_PATH, 'utf8');
  const begin = src.indexOf('// normalize-inline-begin');
  const end = src.indexOf('// normalize-inline-end');
  assert.ok(begin >= 0 && end > begin, 'marcadores normalize-inline no encontrados en find-leads/index.ts');
  const code = src.slice(begin + '// normalize-inline-begin'.length, end);
  // The block is TypeScript (annotations); transpile to JS before evaluating.
  const { code: js } = transformSync(code, { loader: 'ts' });
  return new Function(
    `${js}; return { isSocialUrl, normalizeDomain, normalizePhone };`,
  )() as {
    isSocialUrl: typeof shared.isSocialUrl;
    normalizeDomain: typeof shared.normalizeDomain;
    normalizePhone: typeof shared.normalizePhone;
  };
}

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

test('parity: inline find-leads block matches shared + local (3-way)', () => {
  const inline = inlineNormalize();

  for (const input of PHONES) {
    assert.equal(
      inline.normalizePhone(input),
      shared.normalizePhone(input),
      `inline normalizePhone diverged for ${JSON.stringify(input)}`,
    );
  }
  for (const input of URLS) {
    assert.equal(
      inline.normalizeDomain(input),
      shared.normalizeDomain(input),
      `inline normalizeDomain diverged for ${JSON.stringify(input)}`,
    );
    assert.equal(
      inline.isSocialUrl(input as string),
      shared.isSocialUrl(input as string),
      `inline isSocialUrl diverged for ${JSON.stringify(input)}`,
    );
  }
});
