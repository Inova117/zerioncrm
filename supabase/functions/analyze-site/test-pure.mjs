// Harness de la lógica pura de analyze-site (patrón normalize-parity del repo).
// Extrae los bloques 'analyze-pure' y 'scoring-pure' del index.ts y los prueba
// con node:test. La paridad con el cliente (src/lib/prospecting.ts y
// src/lib/nicheCatalog.ts) se verifica usando LOS MISMOS fixtures y valores
// esperados que el vitest — si las reglas divergen, un test falla.
// Correr: node supabase/functions/analyze-site/test-pure.mjs
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'index.ts'), 'utf8');

function extract(marker) {
  const m = src.match(new RegExp(`\\/\\/ ${marker}-begin\\n([\\s\\S]*?)\\/\\/ ${marker}-end`));
  if (!m) throw new Error(`bloque ${marker} no encontrado`);
  return m[1];
}

const analyzePure = extract('analyze-pure');
const analyzeFn = new Function(
  analyzePure + '\nreturn { isSocialHostPure, extractHtmlSignals, classifyFetchError };'
);
const { isSocialHostPure, extractHtmlSignals, classifyFetchError } = analyzeFn();

const scoringPure = extract('scoring-pure');
const scoringFn = new Function(
  scoringPure + '\nreturn { nicheForPure, webScorePure, agentScorePure, offerPure };'
);
const { nicheForPure, webScorePure, agentScorePure, offerPure } = scoringFn();

const HTML = {
  buena: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"><meta name="description" content="Dentista en Quito"><meta property="og:title" content="Clinica"><title>Clínica Dental — Quito</title></head><body><h1>Bienvenidos</h1><a href="https://instagram.com/clinica">IG</a><a href="https://facebook.com/clinica">FB</a><script src="/wp-content/x.js"></script></body></html>`,
  mala: `<html><head><title>Mi negocio</title></head><body><p>hola</p></body></html>`,
};

const TECH = (over = {}) => ({
  analyzedAt: '2026-08-16T00:00:00.000Z', accessible: true, https: true, httpOk: false,
  certExpired: false, httpStatus: 200, loadTimeMs: 900, title: 'T', hasMetaDescription: true,
  hasH1: true, hasViewport: true, openGraph: true, socials: ['https://instagram.com/x'],
  stackHints: [], ...over,
});

// --- analyze-pure ------------------------------------------------------------
test('extractHtmlSignals: página buena', () => {
  const s = extractHtmlSignals(HTML.buena);
  assert.equal(s.title, 'Clínica Dental — Quito');
  assert.equal(s.hasMetaDescription, true);
  assert.equal(s.hasH1, true);
  assert.equal(s.hasViewport, true);
  assert.equal(s.openGraph, true);
  assert.equal(s.socials.length, 2);
  assert.deepEqual(s.stackHints, ['wordpress']);
});

test('extractHtmlSignals: página pobre', () => {
  const s = extractHtmlSignals(HTML.mala);
  assert.equal(s.hasMetaDescription, false);
  assert.equal(s.hasH1, false);
  assert.equal(s.hasViewport, false);
  assert.equal(s.openGraph, false);
  assert.equal(s.socials.length, 0);
});

test('isSocialHostPure', () => {
  assert.equal(isSocialHostPure('https://instagram.com/x'), true);
  assert.equal(isSocialHostPure('https://www.facebook.com/x'), true);
  assert.equal(isSocialHostPure('https://suweb.com/contacto'), false);
});

test('classifyFetchError: certificado', () => {
  assert.deepEqual(classifyFetchError('TypeError: The certificate has expired'), {
    cert: true,
    reason: 'https falló por certificado/tls',
  });
});

test('classifyFetchError: timeout', () => {
  assert.deepEqual(classifyFetchError('signal timed out'), {
    cert: false,
    reason: 'timeout',
  });
});

// --- scoring-pure (paridad con prospecting.ts / nicheCatalog.ts) -------------
test('nicheForPure: clasifica web / aaas / ambigua', () => {
  assert.equal(nicheForPure('abogados'), 'web');
  assert.equal(nicheForPure('contadores'), 'web');
  assert.equal(nicheForPure('clínicas dentales'), 'aaas');
  assert.equal(nicheForPure('veterinarias'), 'aaas');
  assert.equal(nicheForPure('restaurantes'), 'ambigua');
  assert.equal(nicheForPure('florerías'), 'ambigua');
  assert.equal(nicheForPure(''), 'ambigua');
});

test('webScorePure: buckets iguales al cliente', () => {
  assert.equal(webScorePure({ website: '', reviewCount: 0 }), 95);
  assert.equal(webScorePure({ website: '', reviewCount: 400 }), 100); // cap
  assert.equal(webScorePure({ website: 'https://x.ec', technical: TECH({ certExpired: true }) }), 88);
  assert.equal(webScorePure({ website: 'https://x.ec' }), 70); // sin technical
  assert.equal(webScorePure({ website: 'https://x.ec', technical: TECH() }), 34); // moderna
});

test('agentScorePure: buckets iguales al cliente', () => {
  assert.equal(agentScorePure({ nichePrimary: 'aaas', reviewCount: 200, rating: 4.8, price: '$$$', hasPhone: true }), 100);
  assert.equal(agentScorePure({ nichePrimary: 'web', reviewCount: 200, rating: 4.8, price: '$$$', hasPhone: true }), 30);
  assert.equal(agentScorePure({ nichePrimary: 'ambigua', reviewCount: 5, hasPhone: false }), 0);
  assert.equal(agentScorePure({ nichePrimary: 'aaas', reviewCount: 50, rating: 4.2, hasPhone: true }), 60);
});

test('offerPure: gana el mayor, empate → web', () => {
  assert.equal(offerPure(90, 40), 'web');
  assert.equal(offerPure(30, 80), 'aaas');
  assert.equal(offerPure(70, 70), 'web');
});
