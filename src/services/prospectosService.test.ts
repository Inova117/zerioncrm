// ============================================================================
// Test de integración del Minero de Prospectos (capa mock = la que usa la
// página). Verifica seed, orden por score, rutas de contacto y CRUD.
// No hay jsdom en este proyecto → se stubea localStorage.
// ============================================================================
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { bestRoute, filterProspectos } from '../lib/prospectoUtils';
import { isRoadmapOwner } from '../lib/roadmapGate';
import { discoveryToProspectoInput } from './prospectosService';
import type { User, Discovery } from '../types';

// Este test cubre la capa MOCK (la que corre en dev local). El repo tiene un
// `.env` con las vars de Supabase, así que sin este mock el servicio resolvería
// a la implementación Supabase y pegaría a la tabla real (fallando con
// "Could not find the table 'public.prospectos'"). Forzamos supabase = null
// para que el test sea autosuficiente y `npm test` pase sin overrides de env.
vi.mock('../lib/supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  USE_SUPABASE: false,
}));

// --- stub de localStorage (el mock de db.ts lo usa) ------------------------
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();

const ADMIN = 'usr-admin';

describe('Minero de Prospectos — integración con la capa mock', () => {
  let ensureSeeded: typeof import('./db').ensureSeeded;
  let prospectosService: typeof import('./prospectosService').prospectosService;

  beforeEach(async () => {
    localStorage.clear();
    const db = await import('./db');
    const svc = await import('./prospectosService');
    ensureSeeded = db.ensureSeeded;
    prospectosService = svc.prospectosService;
    ensureSeeded();
  });

  it('siembra los 10 prospectos reales del piloto', async () => {
    const rows = await prospectosService.listFor(ADMIN);
    expect(rows).toHaveLength(10);
    expect(rows.every((p) => p.ownerId === ADMIN)).toBe(true);
  });

  it('los devuelve ordenados por score descendente', async () => {
    const rows = await prospectosService.listFor(ADMIN);
    const scores = rows.map((p) => p.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(rows[0].company).toContain('Terranova'); // 73.1 = el más alto
  });

  it('Terranova está marcado NO-objetivo (capa de juicio Hormozi)', async () => {
    const rows = await prospectosService.listFor(ADMIN);
    const terranova = rows.find((p) => p.company.includes('Terranova'))!;
    expect(terranova.objetivo).toBe(false);
    // …y por eso NO aparece al filtrar solo objetivos, aunque tenga el score más alto
    const objetivos = filterProspectos(rows, { objetivo: true });
    expect(objetivos.some((p) => p.company.includes('Terranova'))).toBe(false);
    expect(objetivos).toHaveLength(9);
  });

  it('Politécnica se contacta por LinkedIn (mejor ruta del piloto)', async () => {
    const rows = await prospectosService.listFor(ADMIN);
    const poli = rows.find((p) => p.company.includes('Politécnica'))!;
    const route = bestRoute(poli);
    expect(route?.channel).toBe('linkedin');
    expect(route?.href).toContain('linkedin.com/company/prepolitecnica');
  });

  it('todo prospecto tiene alguna ruta de contacto', async () => {
    const rows = await prospectosService.listFor(ADMIN);
    const sinRuta = rows.filter((p) => bestRoute(p) === null);
    expect(sinRuta.map((p) => p.company)).toEqual([]);
  });

  it('guarda un prospecto nuevo y le calcula la temperatura del score', async () => {
    const creado = await prospectosService.save(ADMIN, {
      company: 'Academia Nueva',
      segment: 'academia',
      city: 'Guayaquil',
      score: 88,
      contact: { email: 'info@academia.com' },
    });
    expect(creado.temperatura).toBe('prioritario'); // 88 → prioritario
    expect(creado.ownerId).toBe(ADMIN);
    const rows = await prospectosService.listFor(ADMIN);
    expect(rows).toHaveLength(11);
    expect(rows[0].company).toBe('Academia Nueva'); // score más alto → primero
  });

  it('toggleObjetivo y remove funcionan', async () => {
    const rows = await prospectosService.listFor(ADMIN);
    const target = rows.find((p) => p.company.includes('Politécnica'))!;

    const off = await prospectosService.toggleObjetivo(target.id, false);
    expect(off.objetivo).toBe(false);

    await prospectosService.remove(target.id);
    const after = await prospectosService.listFor(ADMIN);
    expect(after).toHaveLength(9);
    expect(after.some((p) => p.id === target.id)).toBe(false);
  });

  it('aísla por dueño: otro usuario no ve los prospectos del fundador', async () => {
    const otros = await prospectosService.listFor('usr-lucia');
    expect(otros).toHaveLength(0);
  });
});

describe('gate ownerOnly de la tab', () => {
  const mk = (over: Partial<User>): User => ({
    id: 'x', email: 'x@x.com', name: 'X', role: 'admin',
    avatarColor: '#000', active: true, createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });
  it('deja pasar al fundador (admin demo) y bloquea al staff', () => {
    expect(isRoadmapOwner(mk({ email: 'admin@zerionstudio.com' }))).toBe(true);
    expect(isRoadmapOwner(mk({ email: 'lucia@zerionstudio.com', role: 'employee' }))).toBe(false);
    // otro admin cualquiera NO ve el módulo personal
    expect(isRoadmapOwner(mk({ email: 'otro@empresa.com', name: 'Otro' }))).toBe(false);
  });
});

describe('discoveryToProspectoInput (autollenado desde el scraper)', () => {
  const disc = (over: Partial<Discovery> = {}): Discovery => ({
    id: 'disc-1',
    placeId: 'place-1',
    company: 'Colegio Nueva Era',
    contactName: '',
    role: '',
    email: 'hola@colegionuevaera.com',
    phone: '0987654321',
    website: 'https://colegionuevaera.com',
    industry: 'colegio privado',
    channel: 'test',
    reason: '',
    service: 'otro',
    assignedTo: 'usr-admin',
    discoveredBy: 'usr-admin',
    createdAt: '2026-08-26T00:00:00.000Z',
    enrichment: {
      rating: 4.7,
      reviewCount: 320,
      city: 'Quito',
      socials: ['https://linkedin.com/company/colegionuevaera'],
      technical: {
        analyzedAt: '2026-08-26T00:00:00.000Z',
        accessible: true,
        https: true,
        httpOk: true,
        certExpired: false,
        httpStatus: 200,
        loadTimeMs: 500,
        title: 'Colegio Nueva Era',
        hasMetaDescription: false,
        hasH1: true,
        hasViewport: true,
        openGraph: false,
        socials: [],
        stackHints: ['wordpress'],
      },
    },
    ...over,
  });

  it('autocompleta señales (reseñas), técnico, contacto y score', () => {
    const input = discoveryToProspectoInput(disc(), 'colegio', 'Quito');
    expect(input.company).toBe('Colegio Nueva Era');
    expect(input.segment).toBe('colegio');
    expect(input.senales?.resenas).toBe(320);
    expect(input.contact?.whatsapp).toBe('0987654321');
    expect(input.contact?.linkedin).toContain('linkedin.com');
    expect(input.technical?.hasMetaDescription).toBe(false);
    expect(input.technical?.stack).toEqual(['wordpress']);
    expect(input.gap).toContain('sin SEO (meta)');
    expect(input.source).toBe('apify');
    expect(input.score).toBeGreaterThan(0);
  });

  it('sin web ni reseñas no rompe (senales undefined, gap sin sitio web)', () => {
    const input = discoveryToProspectoInput(disc({ website: '', enrichment: undefined }), 'academia', 'Quito');
    expect(input.senales).toBeUndefined();
    expect(input.gap).toContain('sin sitio web');
    expect(input.technical).toBeNull();
  });
});
