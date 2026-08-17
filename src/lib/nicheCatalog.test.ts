import { describe, expect, it } from 'vitest';
import { nicheFor, nicheEntry, NICHES } from './nicheCatalog';

describe('nicheCatalog — nicheFor', () => {
  it('clasifica nichos web', () => {
    expect(nicheFor('abogados')).toBe('web');
    expect(nicheFor('contadores')).toBe('web');
    expect(nicheFor('psicólogas')).toBe('web');
    expect(nicheFor('coaches de vida')).toBe('web');
    expect(nicheFor('talleres mecánicos')).toBe('web');
  });

  it('clasifica nichos aaas', () => {
    expect(nicheFor('clínicas dentales')).toBe('aaas');
    expect(nicheFor('veterinarias')).toBe('aaas');
    expect(nicheFor('peluquerías')).toBe('aaas');
    expect(nicheFor('gimnasios')).toBe('aaas');
    expect(nicheFor('ópticas')).toBe('aaas');
  });

  it('restaurantes es ambiguo', () => {
    expect(nicheFor('restaurantes')).toBe('ambigua');
  });

  it('vacío o desconocido → ambigua (se decide por variables)', () => {
    expect(nicheFor('')).toBe('ambigua');
    expect(nicheFor('florerías')).toBe('ambigua');
  });

  it('match parcial por subcadena (plural/singular, acentos)', () => {
    expect(nicheFor('Clínicas Dentales en Quito')).toBe('aaas');
    expect(nicheFor('ABOGADOS')).toBe('web');
  });
});

describe('nicheCatalog — integridad', () => {
  it('cada nicho tiene label, pain y al menos un sinónimo', () => {
    expect(NICHES.length).toBeGreaterThan(5);
    for (const n of NICHES) {
      expect(n.label).toBeTruthy();
      expect(n.pain).toBeTruthy();
      expect(n.synonyms.length).toBeGreaterThan(0);
    }
  });

  it('nicheEntry devuelve la entrada matcheada', () => {
    expect(nicheEntry('dentistas')?.key).toBe('clinicas');
    expect(nicheEntry('nada que ver')).toBeUndefined();
  });
});
