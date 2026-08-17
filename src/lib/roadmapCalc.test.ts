// ============================================================================
// Tests de la lib de cálculos del Roadmap Zerion. Los objetivos deben
// reproducir EXACTO los números del Excel ZERION-GUIA-DIARIA-V1:
// semana 1 = 75 contactos / 12 demos, semanas completas = 105 / 18,
// kill metrics disparadas con 2 semanas seguidas por debajo del umbral.
// ============================================================================
import { describe, expect, it } from 'vitest';
import type { CashMove, RoadmapClient, RoadmapDay } from '../types';
import {
  PLAN_START,
  dayTargets,
  defaultMeta,
  planDays,
  weekRange,
} from '../data/roadmapDefaults';
import {
  cashBalance,
  computeKpis,
  gateCheck,
  monthlyRollups,
  planEnd,
  reserveStatus,
  todayInPlan,
  totals,
  weeklyRollups,
} from './roadmapCalc';

const mkDay = (day: string, over: Partial<RoadmapDay> = {}): RoadmapDay => ({
  day,
  contacts: 0,
  demos: 0,
  webs: 0,
  aaas: 0,
  income: 0,
  content: false,
  notes: '',
  ...over,
});

const mkClient = (over: Partial<RoadmapClient> = {}): RoadmapClient => ({
  id: 'c-1',
  name: 'Clínica Prueba',
  product: 'aaas',
  startDate: '2026-08-20',
  setup: 250,
  monthly: 250,
  status: 'activo',
  notes: '',
  ...over,
});

const mkCash = (over: Partial<CashMove> = {}): CashMove => ({
  id: 'cash-1',
  day: '2026-08-12',
  concept: 'Venta web',
  income: 200,
  expense: 0,
  ...over,
});

describe('ventana del plan (fechas del Excel)', () => {
  it('son 82 días desde 12-ago-2026 hasta 1-nov-2026', () => {
    const days = planDays();
    expect(days).toHaveLength(82);
    expect(days[0]).toBe('2026-08-12');
    expect(days[81]).toBe('2026-11-01');
    expect(planEnd(defaultMeta())).toBe('2026-11-01');
  });

  it('todayInPlan: dentro y fuera de la ventana', () => {
    const meta = defaultMeta();
    expect(todayInPlan(meta, new Date(2026, 7, 12))).toBe(true);
    expect(todayInPlan(meta, new Date(2026, 9, 15))).toBe(true);
    expect(todayInPlan(meta, new Date(2026, 10, 2))).toBe(false);
  });

  it('objetivos del día: 15 contactos siempre; demos 3 lun-vie, 2 sáb, 1 dom', () => {
    expect(dayTargets('2026-08-12')).toEqual({ contacts: 15, demos: 3 }); // miércoles
    expect(dayTargets('2026-08-15')).toEqual({ contacts: 15, demos: 2 }); // sábado
    expect(dayTargets('2026-08-16')).toEqual({ contacts: 15, demos: 1 }); // domingo
    expect(dayTargets('2026-08-17')).toEqual({ contacts: 15, demos: 3 }); // lunes
  });
});

describe('weeklyRollups', () => {
  it('objetivos derivados coinciden con el Excel: semana 1 = 75/12, semana 2 = 105/18', () => {
    const w = weeklyRollups([]);
    expect(w).toHaveLength(12);
    expect(w[0]).toMatchObject({ contactsObj: 75, demosObj: 12, contactsReal: 0, demosReal: 0 });
    expect(w[1]).toMatchObject({ contactsObj: 105, demosObj: 18 });
    expect(w[11]).toMatchObject({ contactsObj: 105, demosObj: 18 });
    expect(weekRange(1)).toEqual({ desde: '2026-08-12', hasta: '2026-08-16' });
    expect(weekRange(2)).toEqual({ desde: '2026-08-17', hasta: '2026-08-23' });
  });

  it('suma los reales y calcula % y close rate por semana', () => {
    const days = [
      mkDay('2026-08-12', { contacts: 10, demos: 2, webs: 1, income: 200 }),
      mkDay('2026-08-13', { contacts: 20, demos: 1 }),
      mkDay('2026-08-14', { contacts: 30 }),
    ];
    const w = weeklyRollups(days);
    expect(w[0].contactsReal).toBe(60);
    expect(w[0].pctContacts).toBe(80); // 60/75
    expect(w[0].demosReal).toBe(3);
    expect(w[0].webs).toBe(1);
    expect(w[0].income).toBe(200);
    expect(w[0].closeWeb).toBeCloseTo(1 / 3);
    // semana 2 sin datos
    expect(w[1].contactsReal).toBe(0);
  });
});

describe('monthlyRollups', () => {
  it('ingreso real por mes + % cumplido contra la meta', () => {
    const meta = defaultMeta();
    const days = [
      mkDay('2026-08-12', { income: 500, webs: 2, aaas: 1 }),
      mkDay('2026-08-25', { income: 300 }),
      mkDay('2026-09-05', { income: 1000 }), // septiembre
    ];
    const m = monthlyRollups(days, meta);
    expect(m.map((r) => r.monthKey)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(m[0]).toMatchObject({ incomeObj: 2400, incomeReal: 800, webs: 2, aaas: 1, pctIncome: 33 });
    expect(m[1]).toMatchObject({ incomeObj: 2500, incomeReal: 1000, mrrObj: 1250 });
    expect(m[2]).toMatchObject({ incomeObj: 2800, incomeReal: 0 });
  });
});

describe('totals (resumen acumulado)', () => {
  it('suma acumulados, MRR solo clientes activos y ratios', () => {
    const days = [
      mkDay('2026-08-12', { contacts: 15, demos: 3, webs: 1, aaas: 0, income: 200 }),
      mkDay('2026-08-13', { contacts: 15, demos: 3, webs: 1, aaas: 1, income: 450 }),
    ];
    const clients = [
      mkClient({ monthly: 250, status: 'activo' }),
      mkClient({ id: 'c-2', monthly: 100, status: 'pausado' }),
    ];
    const t = totals(days, clients);
    expect(t).toMatchObject({ contacts: 30, demos: 6, webs: 2, aaas: 1, income: 650, mrrActive: 250 });
    expect(t.closeWeb).toBeCloseTo(2 / 6);
    expect(t.closeAaaS).toBeCloseTo(1 / 6);
    expect(t.upsell).toBeCloseTo(1 / 2);
  });
});

describe('computeKpis — kill metrics', () => {
  const meta = defaultMeta();

  it('sin datos → pending (no asusta en rojo el día 1)', () => {
    const rows = computeKpis([], [], meta);
    for (const r of rows) expect(r.status).toBe('pending');
  });

  it('2 semanas seguidas bajo 40 contactos → kill', () => {
    const days = [
      ...['2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'].map((d) => mkDay(d, { contacts: 5 })),
      ...['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'].map((d) => mkDay(d, { contacts: 6 })),
    ];
    const rows = computeKpis(days, [], meta);
    const contacts = rows.find((r) => r.key === 'contactsWeek')!;
    expect(contacts.status).toBe('kill');
    expect(contacts.value).toBe(30); // última semana con datos: 5×6
  });

  it('1 sola semana baja → warn, no kill', () => {
    const days = ['2026-08-12', '2026-08-13'].map((d) => mkDay(d, { contacts: 5 }));
    const rows = computeKpis(days, [], meta);
    const contacts = rows.find((r) => r.key === 'contactsWeek')!;
    expect(contacts.status).toBe('warn');
  });

  it('ritmo sobre objetivo → ok', () => {
    const days = ['2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'].map((d) => mkDay(d, { contacts: 16 }));
    const rows = computeKpis(days, [], meta);
    expect(rows.find((r) => r.key === 'contactsWeek')!.status).toBe('ok');
  });

  it('close rate web: 2 semanas con demos y close <15% → kill', () => {
    const days = [
      // semana 1: 10 demos, 1 web (10%)
      ...['2026-08-12', '2026-08-13', '2026-08-14'].map((d) => mkDay(d, { demos: 4, webs: 0 })),
      mkDay('2026-08-15', { demos: 0, webs: 1 }),
      // semana 2: 10 demos, 1 web (10%)
      ...['2026-08-17', '2026-08-18', '2026-08-19'].map((d) => mkDay(d, { demos: 4, webs: 0 })),
      mkDay('2026-08-22', { demos: 0, webs: 1 }),
    ];
    const rows = computeKpis(days, [], meta);
    expect(rows.find((r) => r.key === 'closeWeb')!.status).toBe('kill');
  });

  it('MRR: kill solo desde el mes 2 (septiembre) con <$500', () => {
    const clients = [mkClient({ monthly: 250, status: 'activo' })];
    const days = [mkDay('2026-08-12', { contacts: 10 })];
    // en agosto (mes 1) aún no dispara
    let rows = computeKpis(days, clients, meta, new Date(2026, 7, 20));
    expect(rows.find((r) => r.key === 'mrr')!.status).not.toBe('kill');
    // en septiembre (mes 2) con MRR 250 < 500 → kill
    rows = computeKpis(days, clients, meta, new Date(2026, 8, 15));
    expect(rows.find((r) => r.key === 'mrr')!.status).toBe('kill');
  });

  it('MRR sobre $500 en mes 2 → warn (bajo objetivo 2000), no kill', () => {
    const clients = [mkClient({ monthly: 750, status: 'activo' })];
    const rows = computeKpis([mkDay('2026-08-12', { contacts: 10 })], clients, meta, new Date(2026, 8, 15));
    const mrr = rows.find((r) => r.key === 'mrr')!;
    expect(mrr.status).toBe('warn');
    expect(mrr.value).toBe(750);
  });
});

describe('gates', () => {
  const t = totals(
    [mkDay('2026-08-12', { demos: 10, webs: 3, aaas: 1 })],
    [mkClient({ monthly: 250, status: 'activo' })]
  );

  it('GATE 1: closeWeb ≥20% y closeAaaS ≥10%', () => {
    expect(gateCheck('gate1', { ...t, closeWeb: 0.25, closeAaaS: 0.12 }, 0)).toBe(true);
    expect(gateCheck('gate1', { ...t, closeWeb: 0.15, closeAaaS: 0.5 }, 0)).toBe(false);
    expect(gateCheck('gate1', { ...t, closeWeb: 0.3, closeAaaS: 0.05 }, 0)).toBe(false);
  });

  it('GATE 2: MRR ≥1500 O caja ≥2000', () => {
    expect(gateCheck('gate2', { ...t, mrrActive: 1600 }, 0)).toBe(true);
    expect(gateCheck('gate2', { ...t, mrrActive: 0 }, 2500)).toBe(true);
    expect(gateCheck('gate2', { ...t, mrrActive: 500 }, 300)).toBe(false);
  });
});

describe('finanzas: caja y reserva', () => {
  it('saldo = ingresos - egresos', () => {
    const cash = [
      mkCash({ income: 200 }),
      mkCash({ id: 'cash-2', income: 0, expense: 50 }),
      mkCash({ id: 'cash-3', income: 250, expense: 0 }),
    ];
    expect(cashBalance(cash)).toEqual({ income: 450, expense: 50, net: 400 });
  });

  it('reserva: ok arriba de la reserva, warn debajo, danger en rojo', () => {
    expect(reserveStatus(4000, 3500)).toBe('ok');
    expect(reserveStatus(3500, 3500)).toBe('ok');
    expect(reserveStatus(1000, 3500)).toBe('warn');
    expect(reserveStatus(-5, 3500)).toBe('danger');
  });
});

describe('PLAN_START del Excel', () => {
  it('serial 46246 = 12 de agosto de 2026', () => {
    expect(PLAN_START).toBe('2026-08-12');
  });
});
