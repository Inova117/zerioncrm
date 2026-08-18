import { describe, expect, it } from 'vitest';
import { decide } from './decider';
import type { NichePerformance } from './feedback';
import { saturation } from './saturation';
import type { Saturation } from './saturation';
import type { CityEntry } from './cityCatalog';

const perf = (over: Partial<NichePerformance>): NichePerformance => ({
  niche: 'clinicas', label: 'Clínicas', primary: 'aaas', leads: 10, contacted: 5,
  demos: 2, clients: 1, lost: 0, objections: {}, contactRate: 0.5, demoRate: 0.5,
  closeRate: 0.5, priority: 68, ...over,
});

const cities: CityEntry[] = [
  { key: 'quito', label: 'Quito', tier: 1, note: '', zones: [] },
  { key: 'guayaquil', label: 'Guayaquil', tier: 1, note: '', zones: [] },
];

const emptySat: Record<string, Saturation> = {};

describe('decide — arranque en frío', () => {
  it('sin feedback usa el fallback del catálogo (prioridad neutral 50)', () => {
    const d = decide({
      perf: [],
      fallbackNiches: ['clinicas', 'abogados'],
      cities,
      saturation: emptySat,
    });
    expect(d).not.toBeNull();
    expect(d!.nicheKey).toBe('clinicas');
    expect(d!.cityKey).toBe('quito');
    expect(d!.primary).toBe('aaas');
    expect(d!.priority).toBe(50);
    expect(d!.reason).toContain('arranque en frío');
  });
});

describe('decide — con feedback', () => {
  it('elige el nicho de mayor prioridad', () => {
    const d = decide({
      perf: [
        perf({ niche: 'clinicas', label: 'Clínicas', priority: 68 }),
        perf({ niche: 'abogados', label: 'Abogados', primary: 'web', priority: 52 }),
        perf({ niche: 'psicologos', label: 'Psicólogos', primary: 'web', priority: 45 }),
      ],
      fallbackNiches: ['clinicas', 'abogados', 'psicologos'],
      cities,
      saturation: emptySat,
    });
    expect(d!.nicheKey).toBe('clinicas');
    expect(d!.priority).toBe(68);
    expect(d!.reason).toContain('prioridad');
  });

  it('salta el nicho saturado y cae al siguiente por prioridad', () => {
    const d = decide({
      perf: [
        perf({ niche: 'clinicas', label: 'Clínicas', priority: 68 }),
        perf({ niche: 'abogados', label: 'Abogados', primary: 'web', priority: 52 }),
      ],
      fallbackNiches: ['clinicas', 'abogados'],
      cities,
      saturation: {
        'clinicas:quito': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
      },
    });
    expect(d!.nicheKey).toBe('abogados');
    expect(d!.cityKey).toBe('quito');
  });

  it('todo saturado → null (rota a otro país)', () => {
    const sat: Record<string, Saturation> = {
      'clinicas:quito': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
      'abogados:quito': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
      'clinicas:guayaquil': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
      'abogados:guayaquil': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
    };
    const d = decide({
      perf: [perf({ niche: 'clinicas', priority: 68 }), perf({ niche: 'abogados', primary: 'web', priority: 52 })],
      fallbackNiches: ['clinicas', 'abogados'],
      cities,
      saturation: sat,
    });
    expect(d).toBeNull();
  });
});