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

// --- comportamiento del bloque decision-pure (solo existe en run-campaign) ---
const dBlock = block(runCampaign, 'decision-pure');
const dFn = new Function(
  dBlock +
    '\nreturn { CITIES_PURE, NICHES_DECISION, nicheKeyOf, saturationPure, nextTargetPure };'
);
const { CITIES_PURE, NICHES_DECISION, nicheKeyOf, saturationPure, nextTargetPure } = dFn();

test('decision-pure: catálogo de ciudades (12, tier 1 = Quito/Guayaquil)', () => {
  assert.equal(CITIES_PURE.length, 12);
  assert.equal(CITIES_PURE[0].key, 'quito');
  assert.equal(CITIES_PURE[1].key, 'guayaquil');
  assert.equal(CITIES_PURE[0].tier, 1);
  assert.equal(CITIES_PURE[1].tier, 1);
});

test('decision-pure: nicheKeyOf clasifica nichos', () => {
  assert.equal(nicheKeyOf('clínicas dentales').key, 'clinicas');
  assert.equal(nicheKeyOf('clínicas dentales').primary, 'aaas');
  assert.equal(nicheKeyOf('abogados').key, 'abogados');
  assert.equal(nicheKeyOf('abogados').primary, 'web');
  assert.equal(nicheKeyOf('restaurantes').primary, 'ambigua');
  assert.equal(nicheKeyOf('x y z'), null);
});

test('decision-pure: saturationPure (cap y diminishing)', () => {
  assert.equal(saturationPure({ extracted: 150, lastFound: 0, lastDuplicates: 0 }).reason, 'pool-cap');
  assert.equal(saturationPure({ extracted: 80, lastFound: 5, lastDuplicates: 15 }).reason, 'diminishing');
  assert.equal(saturationPure({ extracted: 50, lastFound: 20, lastDuplicates: 5 }).saturated, false);
});

test('decision-pure: nextTargetPure salta el saturado', () => {
  const sat = { 'clinicas:quito': saturationPure({ extracted: 999, lastFound: 0, lastDuplicates: 0 }) };
  assert.deepEqual(nextTargetPure(['quito', 'guayaquil'], ['clinicas', 'abogados'], sat), {
    nicheKey: 'abogados',
    cityKey: 'quito',
  });
  const allSat = {
    'clinicas:quito': saturationPure({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
    'abogados:quito': saturationPure({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
    'clinicas:guayaquil': saturationPure({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
    'abogados:guayaquil': saturationPure({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
  };
  assert.equal(nextTargetPure(['quito', 'guayaquil'], ['clinicas', 'abogados'], allSat), null);
});
