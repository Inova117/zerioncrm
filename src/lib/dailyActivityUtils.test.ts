// ============================================================================
// Tests de las utilidades de actividad diaria (puras).
// ============================================================================
import { describe, expect, it } from 'vitest';
import { dayKey, mondayOf, weekDays, activityTotals, rowForDay } from './dailyActivityUtils';
import type { DailyActivity } from '../types';

const act = (day: string, n: Partial<DailyActivity> = {}): DailyActivity => ({
  id: `act-${day}`,
  userId: 'u1',
  day,
  calls: 0,
  contacts: 0,
  demos: 0,
  closes: 0,
  notes: '',
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
  ...n,
});

describe('dayKey', () => {
  it('formatea YYYY-MM-DD en fecha local', () => {
    expect(dayKey(new Date(2026, 7, 13))).toBe('2026-08-13');
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('mondayOf / weekDays', () => {
  it('jueves 13-ago-2026 → semana 10-14 ago (L-V)', () => {
    const thu = new Date(2026, 7, 13); // jueves
    expect(dayKey(mondayOf(thu))).toBe('2026-08-10');
    const days = weekDays(thu).map(dayKey);
    expect(days).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']);
  });

  it('domingo pertenece a la semana que empieza el lunes anterior', () => {
    const sun = new Date(2026, 7, 16); // domingo
    expect(dayKey(mondayOf(sun))).toBe('2026-08-10');
  });
});

describe('activityTotals', () => {
  it('suma los campos y calcula ratios', () => {
    const rows = [
      act('2026-08-10', { calls: 20, contacts: 8, demos: 3, closes: 1, notes: 'x' }),
      act('2026-08-11', { calls: 20, contacts: 10, demos: 5, closes: 1 }),
    ];
    const t = activityTotals(rows);
    expect(t.calls).toBe(40);
    expect(t.contacts).toBe(18);
    expect(t.demos).toBe(8);
    expect(t.closes).toBe(2);
    expect(t.daysLogged).toBe(2);
    expect(t.contactRate).toBe(45); // 18/40
    expect(t.demoRate).toBe(20); // 8/40
    expect(t.closeRate).toBe(25); // 2/8
  });

  it('sin demos no divide por cero', () => {
    const t = activityTotals([act('2026-08-10', { calls: 5 })]);
    expect(t.closeRate).toBe(0);
    expect(t.demoRate).toBe(0);
    expect(t.contactRate).toBe(0);
  });

  it('días sin actividad no cuentan como registrados', () => {
    const t = activityTotals([act('2026-08-10')]);
    expect(t.daysLogged).toBe(0);
  });
});

describe('rowForDay', () => {
  it('encuentra el registro del día o null', () => {
    const rows = [act('2026-08-10', { calls: 3 })];
    expect(rowForDay(rows, '2026-08-10')?.calls).toBe(3);
    expect(rowForDay(rows, '2026-08-11')).toBeNull();
  });
});
