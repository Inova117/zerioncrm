// Harness de la lógica pura de analyze-site (patrón normalize-parity del repo).
// Extrae el bloque 'analyze-pure' del index.ts y lo prueba con node:test.
// Correr: node supabase/functions/analyze-site/test-pure.mjs
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'index.ts'), 'utf8');
const m = src.match(/\/\/ analyze-pure-begin\n([\s\S]*?)\/\/ analyze-pure-end/);
if (!m) throw new Error('bloque analyze-pure no encontrado');

const pureSrc = m[1];
const fn = new Function(
  pureSrc +
    '\nreturn { isSocialHostPure, extractHtmlSignals, classifyFetchError };'
);
const { isSocialHostPure, extractHtmlSignals, classifyFetchError } = fn();

const HTML = {
  buena: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"><meta name="description" content="Dentista en Quito"><meta property="og:title" content="Clinica"><title>Clínica Dental — Quito</title></head><body><h1>Bienvenidos</h1><a href="https://instagram.com/clinica">IG</a><a href="https://facebook.com/clinica">FB</a><script src="/wp-content/x.js"></script></body></html>`,
  mala: `<html><head><title>Mi negocio</title></head><body><p>hola</p></body></html>`,
};

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
