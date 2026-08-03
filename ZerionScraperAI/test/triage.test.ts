import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  detectAnalytics,
  detectLanguageFromHtml,
  detectLanguageFromText,
  detectParked,
  extractCopyrightYear,
  extractCtas,
  extractSocialLinks,
  extractWhatsAppPhone,
} from '../src/pipeline/audit/html.js';

test('detectParked flags parked pages, not real sites', () => {
  assert.equal(detectParked('<h1>This domain is for sale!</h1> sedoparking'), true);
  assert.equal(detectParked('<title>Account Suspended</title>'), true);
  assert.equal(detectParked('<h1>Martinez Remodeling — Houston kitchen remodels</h1>'), false);
});

test('extractCopyrightYear picks the latest year across formats', () => {
  assert.equal(extractCopyrightYear('<footer>© 2019 Acme</footer>'), 2019);
  assert.equal(extractCopyrightYear('Copyright 2015 - 2021 Acme LLC'), 2021);
  assert.equal(extractCopyrightYear('&copy; 2018 Foo · © 2023 Bar'), 2023);
  assert.equal(extractCopyrightYear('<footer>no year here</footer>'), null);
});

test('detectAnalytics catches GA/GTM/pixel, ignores plain sites', () => {
  assert.equal(detectAnalytics('<script src="https://www.googletagmanager.com/gtag/js"></script>'), true);
  assert.equal(detectAnalytics('<script>fbq("init","123")</script>'), true);
  assert.equal(detectAnalytics('<script>console.log("hi")</script>'), false);
});

test('language detection: html lang attr wins, stopwords as fallback', () => {
  assert.equal(detectLanguageFromHtml('<html lang="es-MX"><body>x</body></html>'), 'es');
  assert.equal(detectLanguageFromHtml('<html lang="en"><body>x</body></html>'), 'en');
  assert.equal(
    detectLanguageFromText('Ofrecemos servicios de calidad para su casa, con años de trabajo y presupuesto gratis'),
    'es',
  );
  assert.equal(
    detectLanguageFromText('We offer quality services for your home, call today for a free estimate'),
    'en',
  );
  // Short Google reviews must be enough signal (no-website leads rely on them).
  assert.equal(detectLanguageFromText('Excelente trabajo, muy puntuales.'), 'es');
  assert.equal(detectLanguageFromText('Great work, they finished the job on time.'), 'en');
  assert.equal(detectLanguageFromText('xyz 123'), null);
});

test('extractCtas detects conversion features', () => {
  const html = `
    <form action="/contact"></form>
    <a href="tel:+17135550100">Call</a>
    <a href="https://wa.me/17135550100?text=hola">WhatsApp</a>
    <a href="/booking">Book now</a>
    <p>Get a free quote — cotización gratis</p>`;
  assert.deepEqual(extractCtas(html), {
    form: true,
    whatsapp: true,
    phone: true,
    booking: true,
    quote: true,
  });
  assert.deepEqual(extractCtas('<p>plain brochure page</p>'), {
    form: false,
    whatsapp: false,
    phone: false,
    booking: false,
    quote: false,
  });
});

test('extractSocialLinks + extractWhatsAppPhone', () => {
  const html = `
    <a href="https://www.facebook.com/martinezremodeling">FB</a>
    <a href="https://instagram.com/martinez.remodeling">IG</a>
    <a href="https://wa.me/17135550100?text=hi">WA</a>`;
  const socials = extractSocialLinks(html);
  assert.equal(socials.length, 2);
  assert.ok(socials[0]!.includes('facebook.com/martinezremodeling'));
  assert.equal(extractWhatsAppPhone(html), '17135550100');
  assert.equal(extractWhatsAppPhone('no links here'), null);
});
