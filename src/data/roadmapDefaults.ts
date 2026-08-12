import { addDays, format, getDay, parseISO } from 'date-fns';
import type { RoadmapActivity, RoadmapDay, RoadmapMeta } from '../types';

// ============================================================================
// Roadmap Zerion (Guía Diaria V1) — contenido del Excel ZERION-GUIA-DIARIA-V1.
// Única fuente de verdad del plan: ventana de 12 semanas, objetivos diarios,
// metas mensuales, rutina, pitch, proceso de venta, actividades y KPIs.
// Las fechas del Excel (serials 46246..46327) se derivan de PLAN_START.
// ============================================================================

export const PLAN_START = '2026-08-12'; // serial 46246, miércoles
export const PLAN_WEEKS = 12;
/**
 * 82 días reales del Excel (serials 46246..46327): la semana 1 es parcial
 * (miércoles 12-ago → domingo 16-ago, 5 días) y las semanas 2-12 son completas
 * (lun-dom, 7 días). Último día: domingo 1-nov-2026.
 */
export const PLAN_DAYS = 82;

/** Reserva intocable (hoja FINANZAS): mínimo $3.000 = 3 meses de vida. */
export const DEFAULT_RESERVE = 3500;

/** Objetivo diario de contactos (15-20 en la rutina; el tablero usa 15). */
export const CONTACTS_DAILY_TARGET = 15;

/**
 * Objetivo diario de demos por día de la semana, indexado por date-fns
 * getDay() (0 = domingo … 6 = sábado). Excel: lun-vie 3, sáb 2, dom 1.
 */
export const DEMOS_BY_WEEKDAY = [1, 3, 3, 3, 3, 3, 2] as const;

/** Rutina diaria no negociable (hoja PANEL). */
export const ROUTINE: string[] = [
  '15-20 contactos nuevos (WhatsApp/llamada) ANTES de las 14:00',
  'Responder todo lead en <5 minutos',
  'Seguimiento 48h a todo el que no respondió',
  '1 reel cada 3 días (material: las demos)',
  'Entregas en ≤48h (web) / ≤7 días (agente)',
  'Viernes: llenar tablero y revisar KPIs',
];

/** Elevator pitch AaaS — "apréndelo de memoria" (hoja PANEL). */
export const DEFAULT_PITCH =
  'Su negocio tiene una secretaria nueva que trabaja 24 horas: atiende el ' +
  'WhatsApp, agenda citas, confirma clientes y no se enferma ni pide ' +
  'vacaciones. Cuesta $250 instalarla una vez y $250 al mes para que siga ' +
  'trabajando. Todos los viernes le mando un reporte de lo que hizo y cuánto ' +
  'le ahorró. ¿Quiere verla trabajando?';

/** Proceso de venta en 6 pasos (hoja PANEL). */
export const PROCESS_STEPS: string[] = [
  'Busca un negocio en Google Maps (o en la calle).',
  'Escríbele: “Vi su negocio y le construí una página de muestra gratis. ¿Se la muestro? Son 15 minutos.”',
  'Muestra la demo. Si le gusta: $200 y es suya HOY.',
  'Luego: “¿Y si además su WhatsApp se contesta solo? $250 al mes.”',
  'Instala el agente. Cada viernes le llega su reporte de valor.',
  'Pídele: “¿A qué otro negocio conocido suyo le serviría esto?”',
];

/** Costos de referencia (hoja FINANZAS). */
export const REF_COSTS =
  'AaaS: $25-60/mes por cliente (WhatsApp API + n8n + Supabase) · ' +
  'Web: $10-20/año hosting+dominio · Margen AaaS 75-85% · Margen web ~90%';

/** Metas mensuales iniciales (hoja MENSUAL). */
export const DEFAULT_MONTHLY_GOALS: RoadmapMeta['monthlyGoals'] = {
  '2026-08': { income: 2000, mrr: 750 },
  '2026-09': { income: 2200, mrr: 1250 },
  '2026-10': { income: 2500, mrr: 2000 },
};

export const defaultMeta = (): RoadmapMeta => ({
  planStart: PLAN_START,
  pitch: DEFAULT_PITCH,
  reserve: DEFAULT_RESERVE,
  monthlyGoals: DEFAULT_MONTHLY_GOALS,
});

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' local (sin timezone drift al derivar de PLAN_START). */
const d = (daysFromStart: number): string =>
  format(addDays(parseISO(PLAN_START), daysFromStart), 'yyyy-MM-dd');

/** Las 82 fechas de la ventana (semana 1 parcial + 11 semanas completas). */
export const planDays = (): string[] =>
  Array.from({ length: PLAN_DAYS }, (_, i) => d(i));

/** Filas del diario en cero (siembra inicial del módulo, mock y Supabase). */
export const defaultDays = (): RoadmapDay[] =>
  planDays().map((day) => ({
    day,
    contacts: 0,
    demos: 0,
    webs: 0,
    aaas: 0,
    income: 0,
    content: false,
    notes: '',
  }));

/** Objetivos del día: contactos siempre 15; demos según día de la semana. */
export const dayTargets = (day: string): { contacts: number; demos: number } => ({
  contacts: CONTACTS_DAILY_TARGET,
  demos: DEMOS_BY_WEEKDAY[getDay(parseISO(day))],
});

/** Desde/hasta de la semana w (1-based) dentro de la ventana.
 *  Semana 1 = mié-dom (5 días); semanas 2-12 = lun-dom (7 días). */
export const weekRange = (week: number): { desde: string; hasta: string } => {
  const w = Math.min(Math.max(week, 1), PLAN_WEEKS);
  const startOffset = w === 1 ? 0 : 5 + (w - 2) * 7;
  return { desde: d(startOffset), hasta: d(startOffset + (w === 1 ? 4 : 6)) };
};

// ---------------------------------------------------------------------------
// Roadmap — 16 actividades (hoja ROADMAP). dueDate = serial del Excel - 46246.
// ---------------------------------------------------------------------------

interface ActivitySeed {
  week: number;
  phase: RoadmapActivity['phase'];
  title: string;
  responsible: string;
  daysFromStart: number; // 0 = PLAN_START
  isGate?: boolean;
}

const ACTIVITY_SEEDS: ActivitySeed[] = [
  { week: 1, phase: 'Estrategia', title: 'ICP: dueño de negocio local (clínica dental, peluquería, taller). Lista de 100 negocios en Google Maps (Latacunga → Quito)', responsible: 'Martin', daysFromStart: 5 },
  { week: 1, phase: 'Oferta', title: 'One-liners de web y AaaS memorizados. Elevator pitch dicho sin leer', responsible: 'Martin', daysFromStart: 5 },
  { week: 1, phase: 'Estrategia', title: 'Guion de contacto + guion de demo 15 min + secuencia de seguimiento 72h (plantillas del coach)', responsible: 'Martin+Coach', daysFromStart: 5 },
  { week: 1, phase: 'Producto', title: 'Plantilla del agente AaaS lista: WhatsApp API + n8n + calendario + reporte semanal de valor', responsible: 'Martin', daysFromStart: 12 },
  { week: 1, phase: 'Producto', title: '3 demos de página listas (clínica, peluquería, taller)', responsible: 'Martin', daysFromStart: 12 },
  { week: 1, phase: 'Ventas', title: 'INICIO VENTA DIRECTA: 15-20 contactos/día. Primeros 40 contactos esta semana', responsible: 'Martin', daysFromStart: 5 },
  { week: 2, phase: 'Ventas', title: 'Ritmo completo: 75-100 contactos/sem · 15-20 demos/sem · primeras webs cerradas', responsible: 'Martin', daysFromStart: 11 },
  { week: 2, phase: 'Contenido', title: '3 reels publicados (material: las demos construidas)', responsible: 'Martin', daysFromStart: 11 },
  { week: 3, phase: 'Ventas', title: 'Primeros AaaS cerrados (pitch en cada demo de web). Primer value ledger corriendo', responsible: 'Martin', daysFromStart: 18 },
  { week: 4, phase: 'Control', title: 'CIERRE MES 1: tablero completo. Close rate real. Decisión: escalar o corregir guion', responsible: 'Martin', daysFromStart: 19 },
  { week: 5, phase: 'Control', title: 'GATE: close rate web ≥20% y AaaS ≥10%. Si no → cambiar ángulo (coach revisa datos contigo)', responsible: 'Martin', daysFromStart: 25, isGate: true },
  { week: 5, phase: 'Ventas', title: 'Upsell AaaS al 100% de compradores de web (en la misma llamada)', responsible: 'Martin', daysFromStart: 25 },
  { week: 6, phase: 'Ventas', title: 'Referidos: pedir 2-3 contactos a cada cliente feliz', responsible: 'Martin', daysFromStart: 32 },
  { week: 8, phase: 'Control', title: 'CIERRE MES 2: MRR ≥$1,000. Tablero y revisión con coach', responsible: 'Martin', daysFromStart: 46 },
  { week: 9, phase: 'Sistema', title: 'Proceso de venta documentado: scripts finales + carpeta de demos + secuencia estándar', responsible: 'Martin', daysFromStart: 53 },
  { week: 10, phase: 'Escala', title: 'Evaluar al amigo ($200) para agendar demos SOLO si volumen >20 demos/sem', responsible: 'Martin', daysFromStart: 60 },
  { week: 11, phase: 'Control', title: 'GATE 2: MRR ≥$1,500 o caja mensual ≥$2,000. Sí → consolidar. No → re-evaluar nicho', responsible: 'Martin', daysFromStart: 67, isGate: true },
  { week: 12, phase: 'Control', title: 'Reporte final del trimestre: qué funcionó, qué no, decisión Q4 (Ecuador profundo o nicho nuevo)', responsible: 'Martin', daysFromStart: 81 },
];

/** Actividades con ids estables (se re-siembran sin duplicar por id). */
export const defaultActivities = (): RoadmapActivity[] =>
  ACTIVITY_SEEDS.map((a, i) => ({
    id: `roadmap-act-${i + 1}`,
    week: a.week,
    phase: a.phase,
    title: a.title,
    responsible: a.responsible,
    dueDate: d(a.daysFromStart),
    status: 'pendiente',
    isGate: a.isGate ?? false,
    sort: i,
  }));

// ---------------------------------------------------------------------------
// KPIs (hoja KPIs) — objetivo + kill metric. El valor sale del DIARIO.
// ---------------------------------------------------------------------------

export interface KpiDef {
  key: string;
  label: string;
  target: number; // objetivo
  display: 'number' | 'pct' | 'money';
  /**
   * Kill metric: 2 semanas seguidas por debajo de `threshold` = parar y
   * corregir ANTES de gastar más tiempo o plata. `mode: 'month2'` es el caso
   * especial del MRR (mes 2 con <$500 → re-evaluar todo).
   */
  kill: { threshold: number; text: string; mode: 'weeks' | 'month2' } | null;
}

export const KPI_DEFS: KpiDef[] = [
  { key: 'contactsWeek', label: 'Contactos por semana', target: 75, display: 'number', kill: { threshold: 40, text: 'Menos de 40/sem → no estás en la calle', mode: 'weeks' } },
  { key: 'demosWeek', label: 'Demos por semana', target: 15, display: 'number', kill: { threshold: 10, text: 'Menos de 10/sem → el gancho no funciona', mode: 'weeks' } },
  { key: 'closeWeb', label: 'Close rate web', target: 0.2, display: 'pct', kill: { threshold: 0.15, text: 'Menos de 15% → cambiar oferta/precio/nicho', mode: 'weeks' } },
  { key: 'closeAaaS', label: 'Close rate AaaS (sobre demos)', target: 0.1, display: 'pct', kill: { threshold: 0.05, text: 'Menos de 5% → refinar pitch o cambiar nicho', mode: 'weeks' } },
  { key: 'upsell', label: 'Upsell web → AaaS', target: 0.3, display: 'pct', kill: null },
  { key: 'mrr', label: 'MRR', target: 2000, display: 'money', kill: { threshold: 500, text: 'Mes 2 con <$500 → re-evaluar todo', mode: 'month2' } },
  { key: 'incomeQuarter', label: 'Ingreso trimestral', target: 6700, display: 'money', kill: null },
];
