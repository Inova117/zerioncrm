import { addDays, format, parseISO } from 'date-fns';
import type {
  CashMove,
  RoadmapClient,
  RoadmapDay,
  RoadmapMeta,
} from '../types';
import { KPI_DEFS, PLAN_DAYS, PLAN_WEEKS, dayTargets, weekRange } from '../data/roadmapDefaults';
import { pct } from './utils';

// ============================================================================
// Roadmap Zerion — cálculos puros. El DIARIO (RoadmapDay[]) es la fuente de
// verdad: semanas, meses, KPIs y gates se derivan aquí. Sin I/O, sin React.
// Todo lo que muestra Panel/Semanas/KPIs pasa por estas funciones (testeado).
// ============================================================================

export interface WeeklyRow {
  week: number;
  desde: string;
  hasta: string;
  contactsObj: number;
  contactsReal: number;
  pctContacts: number; // 0-100
  demosObj: number;
  demosReal: number;
  pctDemos: number; // 0-100
  webs: number;
  aaas: number;
  income: number;
  closeWeb: number; // webs / demos de la semana (0-1)
}

export interface MonthlyRow {
  monthKey: string; // '2026-08'
  label: string; // 'Agosto'
  incomeObj: number;
  incomeReal: number;
  webs: number;
  aaas: number;
  mrrObj: number;
  pctIncome: number; // 0-100
}

export interface Totals {
  contacts: number;
  demos: number;
  webs: number;
  aaas: number;
  income: number;
  mrrActive: number; // Σ mensualidad de clientes activos
  closeWeb: number; // 0-1 (webs/demos)
  closeAaaS: number; // 0-1 (aaas/demos)
  upsell: number; // 0-1 (aaas/webs)
}

export type KpiStatus = 'ok' | 'warn' | 'kill' | 'pending';

export interface KpiRow {
  key: string;
  label: string;
  target: number;
  /** Etiqueta de objetivo en rango (p.ej. "75-100/sem"), si existe. */
  targetLabel?: string;
  display: 'number' | 'pct' | 'money';
  value: number;
  killText: string | null;
  status: KpiStatus;
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const monthLabel = (monthKey: string): string =>
  MONTH_LABELS[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;

// ---------------------------------------------------------------------------
// Ventana del plan
// ---------------------------------------------------------------------------

/** Última fecha de la ventana (domingo 1-nov-2026 con el plan del Excel). */
export const planEnd = (meta: RoadmapMeta): string =>
  format(addDays(parseISO(meta.planStart), PLAN_DAYS - 1), 'yyyy-MM-dd');

/** ¿La fecha de hoy cae dentro de la ventana del plan? */
export const todayInPlan = (meta: RoadmapMeta, today: Date = new Date()): boolean => {
  const t = format(today, 'yyyy-MM-dd');
  return t >= meta.planStart && t <= planEnd(meta);
};

/** Fecha de hoy como 'YYYY-MM-DD'. */
export const todayKey = (today: Date = new Date()): string => format(today, 'yyyy-MM-dd');

// ---------------------------------------------------------------------------
// Rollups
// ---------------------------------------------------------------------------

const byDay = (days: RoadmapDay[]): Map<string, RoadmapDay> => {
  const m = new Map<string, RoadmapDay>();
  for (const day of days) m.set(day.day, day);
  return m;
};

const sum = (rows: RoadmapDay[], k: keyof Pick<RoadmapDay, 'contacts' | 'demos' | 'webs' | 'aaas' | 'income'>): number =>
  rows.reduce((acc, r) => acc + (r[k] as number), 0);

/** Tabla de 12 semanas: objetivos (derivados de los targets diarios) vs real. */
export function weeklyRollups(days: RoadmapDay[]): WeeklyRow[] {
  const map = byDay(days);
  const rows: WeeklyRow[] = [];
  for (let w = 1; w <= PLAN_WEEKS; w++) {
    const { desde, hasta } = weekRange(w);
    const rows7: RoadmapDay[] = [];
    let contactsObj = 0;
    let demosObj = 0;
    let cursor = parseISO(desde);
    while (format(cursor, 'yyyy-MM-dd') <= hasta) {
      const key = format(cursor, 'yyyy-MM-dd');
      const t = dayTargets(key);
      contactsObj += t.contacts;
      demosObj += t.demos;
      const real = map.get(key);
      if (real) rows7.push(real);
      cursor = addDays(cursor, 1);
    }
    const contactsReal = sum(rows7, 'contacts');
    const demosReal = sum(rows7, 'demos');
    const webs = sum(rows7, 'webs');
    const aaas = sum(rows7, 'aaas');
    rows.push({
      week: w,
      desde,
      hasta,
      contactsObj,
      contactsReal,
      pctContacts: pct(contactsReal, contactsObj),
      demosObj,
      demosReal,
      pctDemos: pct(demosReal, demosObj),
      webs,
      aaas,
      income: sum(rows7, 'income'),
      closeWeb: demosReal > 0 ? webs / demosReal : 0,
    });
  }
  return rows;
}

/** Metas mensuales (objetivos del meta) vs real (suma del diario del mes). */
export function monthlyRollups(days: RoadmapDay[], meta: RoadmapMeta): MonthlyRow[] {
  return Object.entries(meta.monthlyGoals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, goals]) => {
      const rows = days.filter((day) => day.day.slice(0, 7) === monthKey);
      const incomeReal = sum(rows, 'income');
      return {
        monthKey,
        label: monthLabel(monthKey),
        incomeObj: goals.income,
        incomeReal,
        webs: sum(rows, 'webs'),
        aaas: sum(rows, 'aaas'),
        mrrObj: goals.mrr,
        pctIncome: pct(incomeReal, goals.income),
      };
    });
}

// ---------------------------------------------------------------------------
// Resumen acumulado (PANEL)
// ---------------------------------------------------------------------------

export function totals(days: RoadmapDay[], clients: RoadmapClient[]): Totals {
  const contacts = sum(days, 'contacts');
  const demos = sum(days, 'demos');
  const webs = sum(days, 'webs');
  const aaas = sum(days, 'aaas');
  const income = sum(days, 'income');
  const mrrActive = clients
    .filter((c) => c.status === 'activo')
    .reduce((acc, c) => acc + c.monthly, 0);
  return {
    contacts,
    demos,
    webs,
    aaas,
    income,
    mrrActive,
    closeWeb: demos > 0 ? webs / demos : 0,
    closeAaaS: demos > 0 ? aaas / demos : 0,
    upsell: webs > 0 ? aaas / webs : 0,
  };
}

// ---------------------------------------------------------------------------
// KPIs con kill metrics (hoja KPIs)
// ---------------------------------------------------------------------------

/** Semanas que tienen ALGÚN dato real (para kill metrics y valor actual). */
const hasData = (w: WeeklyRow): boolean =>
  w.contactsReal > 0 || w.demosReal > 0 || w.webs > 0 || w.aaas > 0 || w.income > 0;

const lastWeeks = (weekly: WeeklyRow[]): WeeklyRow[] =>
  weekly.filter(hasData).slice(-2);

/** ¿Kill metric disparado? 2 semanas seguidas con datos por debajo del umbral. */
function weeklyKill(weekly: WeeklyRow[], metric: (w: WeeklyRow) => number, threshold: number): boolean {
  const last = lastWeeks(weekly);
  return last.length === 2 && last.every((w) => metric(w) < threshold);
}

/** Meses del plan ya alcanzados (según la fecha real de hoy). */
function reachedMonths(meta: RoadmapMeta, today: Date): string[] {
  const ym = format(today, 'yyyy-MM');
  return Object.keys(meta.monthlyGoals).filter((k) => k <= ym);
}

export function computeKpis(
  days: RoadmapDay[],
  clients: RoadmapClient[],
  meta: RoadmapMeta,
  today: Date = new Date()
): KpiRow[] {
  const weekly = weeklyRollups(days);
  const t = totals(days, clients);
  const anyData = hasData(weekly[0]) || weekly.some(hasData);

  const weekValue = (metric: (w: WeeklyRow) => number): number => {
    const last = weekly.filter(hasData).slice(-1);
    return last.length > 0 ? metric(last[0]) : 0;
  };

  const ratioKill = (metric: (w: WeeklyRow) => number, threshold: number): boolean => {
    // Para ratios el kill se mide sobre las semanas con demos (datos reales).
    const withDemos = weekly.filter((w) => w.demosReal > 0).slice(-2);
    return withDemos.length === 2 && withDemos.every((w) => metric(w) < threshold);
  };

  return KPI_DEFS.map((def) => {
    let value = 0;
    let kill = false;
    if (def.key === 'contactsWeek') value = weekValue((w) => w.contactsReal);
    else if (def.key === 'demosWeek') value = weekValue((w) => w.demosReal);
    else if (def.key === 'closeWeb') value = t.closeWeb;
    else if (def.key === 'closeAaaS') value = t.closeAaaS;
    else if (def.key === 'upsell') value = t.upsell;
    else if (def.key === 'mrr') value = t.mrrActive;
    else if (def.key === 'incomeQuarter') value = t.income;

    if (def.kill) {
      if (def.key === 'contactsWeek') kill = weeklyKill(weekly, (w) => w.contactsReal, def.kill.threshold);
      else if (def.key === 'demosWeek') kill = weeklyKill(weekly, (w) => w.demosReal, def.kill.threshold);
      else if (def.key === 'closeWeb') kill = ratioKill((w) => w.closeWeb, def.kill.threshold);
      else if (def.key === 'closeAaaS') kill = ratioKill((w) => w.aaas / (w.demosReal || 0), def.kill.threshold);
      else if (def.key === 'mrr' && def.kill.mode === 'month2') {
        kill = reachedMonths(meta, today).length >= 2 && value < def.kill.threshold;
      }
    }

    const status: KpiStatus = kill
      ? 'kill'
      : !anyData && (def.key !== 'mrr' || clients.length === 0)
        ? 'pending'
        : value >= def.target
          ? 'ok'
          : 'warn';
    return {
      key: def.key,
      label: def.label,
      target: def.target,
      targetLabel: def.targetLabel,
      display: def.display,
      value,
      killText: def.kill?.text ?? null,
      status,
    };
  });
}

// ---------------------------------------------------------------------------
// Gates del roadmap (filas de Control con veredicto computado)
// ---------------------------------------------------------------------------

export type GateKind = 'gate1' | 'gate2';

/**
 * GATE 1 (semana 5): close web ≥20% Y close AaaS ≥10%.
 * GATE 2 (semana 11): MRR ≥$1.500 O caja mensual ≥$2.000 (usa saldo neto).
 */
export function gateCheck(kind: GateKind, t: Totals, cashNet: number): boolean {
  if (kind === 'gate1') return t.closeWeb >= 0.2 && t.closeAaaS >= 0.1;
  return t.mrrActive >= 1500 || cashNet >= 2000;
}

/** El gate de una actividad isGate según su semana (5 → gate1, 11 → gate2). */
export const gateKindForWeek = (week: number): GateKind | null =>
  week === 5 ? 'gate1' : week === 11 ? 'gate2' : null;

// ---------------------------------------------------------------------------
// Finanzas: caja y reserva
// ---------------------------------------------------------------------------

export function cashBalance(cash: CashMove[]): { income: number; expense: number; net: number } {
  const income = cash.reduce((acc, m) => acc + m.income, 0);
  const expense = cash.reduce((acc, m) => acc + m.expense, 0);
  return { income, expense, net: income - expense };
}

/** Estado de la reserva intocable: net ≥ reserva → ok; positivo pero debajo → warn; negativo → danger. */
export function reserveStatus(net: number, reserve: number): 'ok' | 'warn' | 'danger' {
  if (net < 0) return 'danger';
  return net >= reserve ? 'ok' : 'warn';
}
