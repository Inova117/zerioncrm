// Verifica que los bloques puros (analyze-pure, scoring-pure) de run-campaign
// sean COPIAS IDÉNTICAS de los de analyze-site (paridad). Si editas las reglas
// en un archivo sin el otro, este test falla.
// Correr: node supabase/functions/run-campaign/test-parity.mjs
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const analyzeSite = readFileSync(join(here, '..', 'analyze-site', 'index.ts'), 'utf8');
const runCampaign = readFileSync(join(here, 'index.ts'), 'utf8');

function block(src, marker) {
  const m = src.match(new RegExp(`\\/\\/ ${marker}-begin\\n([\\s\\S]*?)\\/\\/ ${marker}-end`));
  if (!m) throw new Error(`bloque ${marker} no encontrado`);
  return m[1];
}

test('paridad analyze-pure (analyze-site == run-campaign)', () => {
  assert.equal(block(runCampaign, 'analyze-pure'), block(analyzeSite, 'analyze-pure'));
});

test('paridad scoring-pure (analyze-site == run-campaign)', () => {
  assert.equal(block(runCampaign, 'scoring-pure'), block(analyzeSite, 'scoring-pure'));
});
