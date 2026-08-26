// ============================================================================
// Tests de utilidades del Minero de Prospectos (puras).
// ============================================================================
import { describe, expect, it } from 'vitest';
import {
  computeTemperatura,
  contactRoutes,
  bestRoute,
  filterProspectos,
  mensajeFrio,
  segmentLabel,
} from './prospectoUtils';
import type { Prospecto } from '../types';

const base: Omit<Prospecto, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'score'> = {
  company: 'Preuniversitario X',
  segment: 'preuniversitario',
  city: 'Quito',
  temperatura: 'tibio',
  objetivo: true,
  source: 'manual',
};
const make = (over: Partial<Prospecto> = {}): Prospecto => ({
  id: 'p1',
  ownerId: 'usr-admin',
  score: 60,
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
  ...base,
  ...over,
});

describe('computeTemperatura', () => {
  it('mapea bandas correctamente (espejo del modelo)', () => {
    expect(computeTemperatura(90)).toBe('prioritario');
    expect(computeTemperatura(85)).toBe('prioritario');
    expect(computeTemperatura(70)).toBe('caliente');
    expect(computeTemperatura(50)).toBe('tibio');
    expect(computeTemperatura(20)).toBe('frio');
  });
});

describe('contactRoutes / bestRoute', () => {
  it('prioriza LinkedIn > email > WhatsApp > teléfono > web', () => {
    const p = make({
      contact: {
        linkedin: 'https://linkedin.com/company/x',
        email: 'x@x.com',
        whatsapp: '0978616162',
        telefono: '02 250 9550',
        web: 'https://x.com',
      },
    });
    expect(bestRoute(p)?.channel).toBe('linkedin');
    expect(contactRoutes(p).map((r) => r.channel)).toEqual([
      'linkedin',
      'email',
      'whatsapp',
      'telefono',
      'web',
    ]);
  });

  it('cae a email cuando no hay LinkedIn', () => {
    const p = make({ contact: { email: 'a@b.com', web: 'https://x.com' } });
    expect(bestRoute(p)?.channel).toBe('email');
  });

  it('wa.me normaliza el formato ecuatoriano (0978… → 593978…)', () => {
    const p = make({ contact: { whatsapp: '0985657880', web: 'https://x.com' } });
    const wa = contactRoutes(p).find((r) => r.channel === 'whatsapp');
    expect(wa?.href).toContain('wa.me/593985657880');
  });

  it('sin contacto devuelve ruta web o ninguna', () => {
    expect(bestRoute(make({ contact: {} }))).toBeNull();
    expect(bestRoute(make({ website: 'https://x.com' }))?.channel).toBe('web');
  });
});

describe('filterProspectos', () => {
  const list = [
    make({ id: 'a', company: 'Colegio Los Pinos', segment: 'colegio', city: 'Quito', score: 61, objetivo: true }),
    make({ id: 'b', company: 'Preuniversitario Newton', segment: 'preuniversitario', city: 'Guayaquil', score: 65, objetivo: true }),
    make({ id: 'c', company: 'Terranova', segment: 'colegio', city: 'Quito', score: 73, objetivo: false }),
  ];
  it('busca por texto', () => {
    expect(filterProspectos(list, { q: 'pinos' }).map((p) => p.id)).toEqual(['a']);
  });
  it('filtra por segmento + ciudad', () => {
    expect(filterProspectos(list, { segment: 'colegio', city: 'Quito' }).map((p) => p.id)).toEqual(['a', 'c']);
  });
  it('filtra por objetivo/no-objetivo', () => {
    expect(filterProspectos(list, { objetivo: false }).map((p) => p.id)).toEqual(['c']);
  });
  it('combina texto + filtros sin coincidencia', () => {
    expect(filterProspectos(list, { q: 'newton', segment: 'colegio' })).toHaveLength(0);
  });
});

describe('mensajeFrio', () => {
  it('NO usa "usted" ni muestra precios', () => {
    const p = make({ gap: 'WordPress sin meta-description · dependen de boca a boca' });
    const m = mensajeFrio(p);
    expect(m).toContain('Le escribo porque');
    expect(m).not.toMatch(/usted|ustedes|\$\d/);
  });
});

describe('segmentLabel', () => {
  it('da label o cae a la key', () => {
    expect(segmentLabel('preuniversitario')).toBe('Preuniversitario');
    expect(segmentLabel('otro')).toBe('Otro');
  });
});
