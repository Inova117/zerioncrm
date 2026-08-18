import { describe, expect, it } from 'vitest';
import { saturation, nextTarget, DEFAULT_CAP, DEFAULT_NEW_RATE_MIN } from './saturation';

describe('saturation — cuándo un nicho+ciudad está gastado', () => {
  it('sin datos → no saturado, newRate 1', () => {
    const s = saturation({ extracted: 0, lastFound: 0, lastDuplicates: 0 });
    expect(s.saturated).toBe(false);
    expect(s.newRate).toBe(1);
    expect(s.reason).toBeNull();
  });

  it('llegó al cap → pool-cap', () => {
    const s = saturation({ extracted: DEFAULT_CAP, lastFound: 10, lastDuplicates: 0 });
    expect(s.saturated).toBe(true);
    expect(s.reason).toBe('pool-cap');
  });

  it('quedan pocos nuevos (newRate < mínimo) → diminishing', () => {
    // 5 nuevos de 20 intentos = 0.25 < 0.4
    const s = saturation({ extracted: 80, lastFound: 5, lastDuplicates: 15 });
    expect(s.newRate).toBeCloseTo(0.25);
    expect(s.saturated).toBe(true);
    expect(s.reason).toBe('diminishing');
  });

  it('todavía rinde (newRate alto) → no saturado', () => {
    const s = saturation({ extracted: 50, lastFound: 20, lastDuplicates: 5 });
    expect(s.newRate).toBeCloseTo(0.8);
    expect(s.saturated).toBe(false);
  });

  it('sin duplicados en la última corrida → no marca diminishing aunque haya pocos', () => {
    const s = saturation({ extracted: 10, lastFound: 2, lastDuplicates: 0 });
    expect(s.saturated).toBe(false);
  });

  it('respeta umbral de newRate configurable', () => {
    const s = saturation({ extracted: 80, lastFound: 5, lastDuplicates: 15 }, { newRateMin: 0.2 });
    expect(s.saturated).toBe(false); // 0.25 >= 0.2 → aún rinde
    expect(DEFAULT_NEW_RATE_MIN).toBe(0.4);
  });
});

describe('nextTarget — rotación al siguiente no saturado', () => {
  const cities = ['quito', 'guayaquil'];
  const niches = ['clinicas', 'abogados'];

  it('devuelve el primero no saturado (quito:clinicas)', () => {
    expect(nextTarget(cities, niches, {})).toEqual({ nicheKey: 'clinicas', cityKey: 'quito' });
  });

  it('salta el saturado', () => {
    const sat = {
      'clinicas:quito': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
    };
    expect(nextTarget(cities, niches, sat)).toEqual({ nicheKey: 'abogados', cityKey: 'quito' });
  });

  it('pasa a la siguiente ciudad si el nicho top está saturado en todas', () => {
    const sat = {
      'clinicas:quito': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
      'abogados:quito': saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 }),
    };
    expect(nextTarget(cities, niches, sat)).toEqual({ nicheKey: 'clinicas', cityKey: 'guayaquil' });
  });

  it('todo saturado → null', () => {
    const sat = Object.fromEntries(
      cities.flatMap((c) => niches.map((n) => [`${n}:${c}`, saturation({ extracted: 999, lastFound: 0, lastDuplicates: 0 })]))
    );
    expect(nextTarget(cities, niches, sat)).toBeNull();
  });
});