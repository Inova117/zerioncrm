import { describe, expect, it } from 'vitest';
import { CITIES, cityByKey, citiesByTier, defaultCityOrder } from './cityCatalog';

describe('cityCatalog — catálogo curado de Ecuador', () => {
  it('tiene 12 ciudades', () => {
    expect(CITIES).toHaveLength(12);
  });

  it('quito y guayaquil son tier 1 con PIB per cápita real', () => {
    const quito = cityByKey('quito');
    const gye = cityByKey('guayaquil');
    expect(quito?.tier).toBe(1);
    expect(quito?.gdpPerCapita).toBe(9707);
    expect(quito?.zones).toContain('Cumbayá');
    expect(gye?.tier).toBe(1);
    expect(gye?.gdpPerCapita).toBe(9301);
    expect(gye?.zones).toContain('Samborondón');
  });

  it('citiesByTier(1) = [Quito, Guayaquil]', () => {
    expect(citiesByTier(1).map((c) => c.key)).toEqual(['quito', 'guayaquil']);
  });

  it('citiesByTier(2) tiene 4 (Cuenca, Machala, Manta, Ambato)', () => {
    expect(citiesByTier(2).map((c) => c.key)).toEqual(['cuenca', 'machala', 'manta', 'ambato']);
  });

  it('citiesByTier(3) tiene 6', () => {
    expect(citiesByTier(3)).toHaveLength(6);
  });

  it('defaultCityOrder: tier 1 → 2 → 3, orden estable', () => {
    const order = defaultCityOrder().map((c) => c.key);
    expect(order.slice(0, 2)).toEqual(['quito', 'guayaquil']);
    expect(order.indexOf('quito')).toBeLessThan(order.indexOf('cuenca'));
    expect(order.indexOf('cuenca')).toBeLessThan(order.indexOf('loja'));
    expect(order).toHaveLength(12);
  });

  it('cityByKey desconocida → undefined', () => {
    expect(cityByKey('lima')).toBeUndefined();
  });
});