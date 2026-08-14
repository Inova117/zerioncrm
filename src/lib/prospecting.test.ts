import { describe, expect, it } from 'vitest';
import { opportunityScore, nichoStats, coldMessage, issuesOf } from './prospecting';
import type { Discovery, SiteTechnical } from '../types';

const tech = (over: Partial<SiteTechnical> = {}): SiteTechnical => ({
  analyzedAt: '2026-08-14T00:00:00.000Z', accessible: true, https: true, httpOk: false,
  certExpired: false, httpStatus: 200, loadTimeMs: 900, title: 'T', hasMetaDescription: true,
  hasH1: true, hasViewport: true, openGraph: true, socials: ['https://instagram.com/x'],
  stackHints: [], ...over,
});

const disc = (over: Partial<Discovery> = {}): Discovery => ({
  id: 'd1', placeId: 'p1', company: 'Clínica Dental Quito', contactName: '', role: '',
  email: '', phone: '', website: 'https://clinica.ec', industry: 'clínicas', channel: 'x',
  reason: 'x', service: 'web', assignedTo: 'u1', discoveredBy: 'u1',
  createdAt: '2026-08-14T00:00:00.000Z', ...over,
});

describe('opportunityScore — servicio web', () => {
  it('sin web = 95-100', () => {
    const s = opportunityScore(disc({ website: '' }), 'web');
    expect(s).toBeGreaterThanOrEqual(95);
    expect(s).toBeLessThanOrEqual(100);
  });
  it('sin web con muchas reseñas no supera 100 (cap)', () => {
    const s = opportunityScore(disc({ website: '', enrichment: { reviewCount: 400 } }), 'web');
    expect(s).toBeLessThanOrEqual(100);
  });
  it('cert vencido = 88-94', () => {
    const s = opportunityScore(disc({ enrichment: { technical: tech({ certExpired: true }) } }), 'web');
    expect(s).toBeGreaterThanOrEqual(88);
    expect(s).toBeLessThanOrEqual(94);
  });
  it('web sin responsive (sin viewport) = 80-89', () => {
    const s = opportunityScore(disc({ enrichment: { technical: tech({ hasViewport: false }) } }), 'web');
    expect(s).toBeGreaterThanOrEqual(80);
    expect(s).toBeLessThanOrEqual(89);
  });
  it('SEO pobre (sin meta ni h1) = 75-85', () => {
    const s = opportunityScore(disc({ enrichment: { technical: tech({ hasMetaDescription: false, hasH1: false }) } }), 'web');
    expect(s).toBeGreaterThanOrEqual(75);
    expect(s).toBeLessThanOrEqual(85);
  });
  it('web moderna completa = 0-49', () => {
    const s = opportunityScore(disc({ enrichment: { technical: tech() } }), 'web');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(49);
  });
  it('web declarada pero inaccesible = 70-87 (incertidumbre, sin inventar)', () => {
    const s = opportunityScore(disc({ enrichment: { technical: tech({ accessible: false, https: false }) } }), 'web');
    expect(s).toBeGreaterThanOrEqual(70);
    expect(s).toBeLessThanOrEqual(87);
  });
});

describe('opportunityScore — servicio seo', () => {
  it('sin title/meta/h1 = 90-100', () => {
    const s = opportunityScore(
      disc({ service: 'marketing', enrichment: { technical: tech({ title: '', hasMetaDescription: false, hasH1: false }) } }),
      'seo'
    );
    expect(s).toBeGreaterThanOrEqual(90);
    expect(s).toBeLessThanOrEqual(100);
  });
  it('seo completo = 0-29', () => {
    const s = opportunityScore(disc({ service: 'marketing', enrichment: { technical: tech() } }), 'seo');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(29);
  });
});

describe('opportunityScore — servicio marketing', () => {
  it('sin redes = 90-100', () => {
    const s = opportunityScore(disc({ service: 'otro', enrichment: { technical: tech({ socials: [] }) } }), 'marketing');
    expect(s).toBeGreaterThanOrEqual(90);
    expect(s).toBeLessThanOrEqual(100);
  });
  it('con redes = 30-59', () => {
    const s = opportunityScore(disc({ service: 'otro', enrichment: { technical: tech() } }), 'marketing');
    expect(s).toBeGreaterThanOrEqual(30);
    expect(s).toBeLessThanOrEqual(59);
  });
});

describe('nichoStats', () => {
  it('agrega los KPIs del nicho', () => {
    const list = [
      disc({ id: 'a', website: '' }),
      disc({ id: 'b', enrichment: { technical: tech({ certExpired: true }) } }),
      disc({ id: 'c', enrichment: { technical: tech() } }),
      disc({ id: 'd', website: 'https://x.ec' }), // sin technical aún
    ];
    const stats = nichoStats(list);
    expect(stats.total).toBe(4);
    expect(stats.withoutWebsite).toBe(1);
    expect(stats.httpsBroken).toBe(1);
    expect(stats.seoMissing).toBe(0);
    expect(stats.analyzed).toBe(2);
    expect(stats.hot).toBe(2); // la sin web (95) y la cert roto (88)
    expect(stats.avgScore).toBeGreaterThan(0);
  });
});

describe('coldMessage', () => {
  it('resuelve variables, usa voz USTED y menciona el problema real', () => {
    const msg = coldMessage(
      disc({ enrichment: { rating: 4.6, reviewCount: 120, city: 'Quito', technical: tech({ certExpired: true }) } })
    );
    expect(msg).toContain('Clínica Dental Quito');
    expect(msg).not.toContain('[EMPRESA]');
    expect(msg).not.toContain('[PROBLEMA]');
    expect(msg).not.toContain('Buenas'); // guion: nunca «Buenas»
    expect(msg).toContain('120 reseñas');
    expect(msg).toContain('certificado');
    expect(msg).not.toContain('$'); // sin precios en frío
  });
});

describe('issuesOf', () => {
  it('sin web → problema "no tiene página"', () => {
    expect(issuesOf(disc({ website: '' }))[0]).toContain('No tiene página web');
  });
  it('cert vencido → problema del certificado', () => {
    expect(issuesOf(disc({ enrichment: { technical: tech({ certExpired: true }) } }))[0]).toContain('certificado');
  });
  it('web moderna → mensaje de estándar alto (no inventa problemas)', () => {
    expect(issuesOf(disc({ enrichment: { technical: tech() } }))[0]).toContain('estándar');
  });
});
