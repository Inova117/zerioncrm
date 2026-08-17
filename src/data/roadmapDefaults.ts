import { addDays, format, getDay, parseISO } from 'date-fns';
import type { RoadmapActivity, RoadmapDay, RoadmapMeta, RoadmapReparto } from '../types';

// ============================================================================
// Roadmap Zerion — contenido MERGEADO de dos fuentes:
//   1. ZERION-GUIA-DIARIA-V1.xlsx (diario, rutina, finanzas, KPIs)
//   2. ROADMAP-ZERION-12-SEMANAS.md (documento principal: reparto, horas,
//      one-liners, marketing, plan de contenidos, supuestos)
// Única fuente de verdad del módulo. Las fechas se derivan de PLAN_START.
// ============================================================================

export const PLAN_START = '2026-08-12'; // serial 46246, miércoles
export const PLAN_WEEKS = 12;
/**
 * 82 días reales del Excel (serials 46246..46327): la semana 1 es parcial
 * (miércoles 12-ago → domingo 16-ago, 5 días) y las semanas 2-12 son completas
 * (lun-dom, 7 días). Último día: domingo 1-nov-2026.
 */
export const PLAN_DAYS = 82;

/** Versión de la semilla de contenido. Al subirla, el servicio auto-migra
 *  actividades + metas mensuales (preservando capturas del diario y finanzas). */
export const SEED_VERSION = 2;

/** Reserva intocable: mínimo $3.000 = 3 meses de vida. */
export const DEFAULT_RESERVE = 3500;

/** Burn personal mínimo (documento principal). */
export const BURN_PERSONAL = 1000;

/** Regla de caja (documento principal). */
export const REGLA_CAJA =
  'Toda venta de web es caja inmediata. Todo setup AaaS es caja inmediata. ' +
  'El MRR es lo que hace que marzo de 2027 no dependa de vender otra vez.';

/** Objetivo diario de contactos (piso tracked; la meta es 15-20). */
export const CONTACTS_DAILY_TARGET = 15;

/**
 * Objetivo diario de demos por día de la semana, indexado por date-fns
 * getDay() (0 = domingo … 6 = sábado). Excel: lun-vie 3, sáb 2, dom 1.
 */
export const DEMOS_BY_WEEKDAY = [1, 3, 3, 3, 3, 3, 2] as const;

/** Rutina diaria no negociable (mergeada: reels 1/día batcheados). */
export const ROUTINE: string[] = [
  '15-20 contactos nuevos (WhatsApp/llamada) ANTES de las 14:00',
  'Responder todo lead en <5 minutos',
  'Seguimiento 48h a todo el que no respondió',
  '1 reel al día (produce en batch 1h cada 3 días; material: las demos)',
  'Entregas en ≤48h (web) / ≤7 días (agente)',
  'Viernes: llenar tablero y revisar KPIs (15 min)',
];

/** Elevator pitch AaaS — "apréndelo de memoria". */
export const DEFAULT_PITCH =
  'Su negocio tiene una secretaria nueva que trabaja 24 horas: atiende el ' +
  'WhatsApp, agenda citas, confirma clientes y no se enferma ni pide ' +
  'vacaciones. Cuesta $250 instalarla una vez y $250 al mes para que siga ' +
  'trabajando. Todos los viernes le mando un reporte de lo que hizo y cuánto ' +
  'le ahorró. ¿Quiere verla trabajando?';

/** One-liner de web (demo-first) — "la demo ES el vendedor". */
export const ONE_LINER_WEB =
  'Su página ya está hecha. Véala gratis. Si le gusta, es suya por $200.';

/** Buyer persona (ICP) del documento principal. */
export const ICP_TEXT =
  'Dueño de negocio local (clínica dental, peluquería, taller, restaurante). ' +
  'Decide solo, es WhatsApp-first; le duele el "no contesto a tiempo". Un solo ' +
  'perfil, nada de segmentar 4 mercados.';

/** Mix de la lista de 100 negocios objetivo. */
export const LISTA_MIX =
  'Clínicas dentales 50% · peluquerías 25% · talleres/restaurantes 25%';

/** Proceso de venta en 6 pasos. */
export const PROCESS_STEPS: string[] = [
  'Busca un negocio en Google Maps (o en la calle).',
  'Escríbele: “Vi su negocio y le construí una página de muestra gratis. ¿Se la muestro? Son 15 minutos.”',
  'Muestra la demo. Si le gusta: $200 y es suya HOY.',
  'Luego: “¿Y si además su WhatsApp se contesta solo? $250 al mes.”',
  'Instala el agente. Cada viernes le llega su reporte de valor.',
  'Pídele: “¿A qué otro negocio conocido suyo le serviría esto?”',
];

/** Canales de marketing en orden de prioridad (documento principal). */
export const MARKETING_CHANNELS: { canal: string; detalle: string }[] = [
  { canal: 'Venta directa (canal #1)', detalle: 'WhatsApp + llamada + visita. Es lo único que produce caja esta semana.' },
  { canal: 'Contenido (IG reels)', detalle: 'La fábrica de demos produce el contenido. Prueba social para los que dudan.' },
  { canal: 'Referidos', detalle: 'Pedir siempre. Gremios chicos: un doctor feliz vale 50 llamadas.' },
  { canal: 'Google Maps / SEO local', detalle: 'A mediano plazo (mes 3+), cuando haya reseñas.' },
  { canal: 'Sin pauta pagada', detalle: 'Hasta que la venta directa tenga close rate estable (no quemar plata antes de un guion que convierte).' },
];

/** Plan de contenidos — Rule of 100 adaptada. */
export const CONTENT_PLAN = {
  cadencia: '1 reel/día, batcheado 1 hora cada 3 días.',
  hook: '“Le construí la página a este negocio sin cobrarle un centavo.”',
  retain: 'El antes/después real: “Así se ve un negocio en Google sin página vs con página.”',
  reward: '“¿Quiere la suya? Escríbame.”',
  material: 'Cada demo construida ES un reel. Cero contenido inventado.',
};

/** Notas y supuestos (honestidad total del documento principal). */
export const SUPUESTOS: string[] = [
  'Los close rates (20% web / 10% AaaS) son hipótesis basadas en benchmarks de outbound LATAM. Las primeras 50 demos las confirman o corrigen.',
  'El AaaS a $250/mes necesita validar disposición de pago real. El tier de $99 y los pilotos gratis son el plan B si hay resistencia.',
  'El riesgo real no es el mercado — es la constancia. Regla de hierro: 15-20 contactos/día SIN excepción, incluso los días sin ganas.',
  'Este plan no depende de eventos ni redes externas: depende de una persona que marca números todos los días.',
  'Si en 4 semanas de venta directa intensa no hay close rate ≥20%, no es falta de esfuerzo — es oferta o nicho. Se corrige con datos, no con más aguante.',
];

/** Leyenda del reparto de trabajo. */
export const REPARTO_LEGEND: { key: RoadmapReparto; emoji: string; label: string }[] = [
  { key: 'verde', emoji: '🟩', label: 'Lo ejecuta Martin' },
  { key: 'naranja', emoji: '🟧', label: 'Martin con plantilla del coach' },
  { key: 'azul', emoji: '🟦', label: 'Lo hace el sistema (agente, reportes)' },
];

/** Costos de referencia (hoja FINANZAS + documento principal). */
export const REF_COSTS =
  'AaaS: $25-60/mes por cliente (WhatsApp API + n8n + Supabase) · ' +
  'Web: $10-20/año hosting+dominio · Margen AaaS 75-85% (setup ~100%) · ' +
  'Margen web ~90% · Inversión en herramientas: $0-50/mes';

/** Metas mensuales mergeadas (objetivo editable). */
export const DEFAULT_MONTHLY_GOALS: RoadmapMeta['monthlyGoals'] = {
  '2026-08': { income: 2400, mrr: 750 },
  '2026-09': { income: 2500, mrr: 1250 },
  '2026-10': { income: 2800, mrr: 2000 },
};

export const defaultMeta = (): RoadmapMeta => ({
  planStart: PLAN_START,
  pitch: DEFAULT_PITCH,
  reserve: DEFAULT_RESERVE,
  monthlyGoals: DEFAULT_MONTHLY_GOALS,
  seedVersion: SEED_VERSION,
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
// Roadmap — actividades mergeadas (Excel + documento principal), con horas
// y reparto. dueDate = días desde PLAN_START.
// ---------------------------------------------------------------------------

interface ActivitySeed {
  week: number;
  phase: RoadmapActivity['phase'];
  title: string;
  responsible: string;
  daysFromStart: number;
  hours: number;
  reparto: RoadmapReparto;
  isGate?: boolean;
}

const ACTIVITY_SEEDS: ActivitySeed[] = [
  { week: 1, phase: 'Estrategia', title: 'ICP: dueño de negocio local (clínica dental, peluquería, taller, restaurante). Decide solo, WhatsApp-first; le duele el "no contesto a tiempo"', responsible: 'Martin', daysFromStart: 5, hours: 2, reparto: 'verde' },
  { week: 1, phase: 'Oferta', title: 'One-liner web memorizado: "Su página ya está hecha. Véala gratis. Si le gusta, es suya por $200."', responsible: 'Martin', daysFromStart: 5, hours: 1, reparto: 'verde' },
  { week: 1, phase: 'Oferta', title: 'One-liner AaaS + elevator pitch de 3 frases, dicho sin leer', responsible: 'Martin+Coach', daysFromStart: 5, hours: 1, reparto: 'naranja' },
  { week: 1, phase: 'Estrategia', title: 'Lista de 100 negocios en Google Maps (Latacunga → Quito). Mix: clínicas 50% · peluquerías 25% · talleres/restaurantes 25%', responsible: 'Martin', daysFromStart: 5, hours: 3, reparto: 'verde' },
  { week: 1, phase: 'Producto', title: 'Plantilla del agente AaaS: WhatsApp API + n8n + calendario + reporte semanal. Reutilizable (cada cliente = config, no desarrollo)', responsible: 'Martin', daysFromStart: 12, hours: 12, reparto: 'verde' },
  { week: 1, phase: 'Producto', title: '3 demos de página listas (clínica, peluquería, taller). Son el argumento de venta #1', responsible: 'Martin', daysFromStart: 12, hours: 6, reparto: 'verde' },
  { week: 1, phase: 'Oferta', title: 'Plantilla de mensaje de contacto + guion de demo 15 min + secuencia de seguimiento 72h', responsible: 'Martin+Coach', daysFromStart: 12, hours: 2, reparto: 'naranja' },
  { week: 1, phase: 'Control', title: 'Tablero semanal (contactos, demos, cierres, close rate, MRR). Se llena cada viernes, 15 min', responsible: 'Martin+Coach', daysFromStart: 12, hours: 1, reparto: 'naranja' },
  { week: 1, phase: 'Ventas', title: 'INICIO VENTA DIRECTA: 15-20 contactos/día (WhatsApp + llamada). Meta 60-80 contactos/sem', responsible: 'Martin', daysFromStart: 5, hours: 20, reparto: 'verde' },
  { week: 2, phase: 'Ventas', title: 'Ritmo completo: 15-20 contactos/día · 15-20 demos/sem · primeras webs cerradas ($200, entrega 48h)', responsible: 'Martin', daysFromStart: 11, hours: 20, reparto: 'verde' },
  { week: 2, phase: 'Contenido', title: 'Reels: 1/día, batcheado 1h cada 3 días. Hook: "Le construí la página sin cobrarle un centavo". Cada demo ES un reel', responsible: 'Martin', daysFromStart: 11, hours: 3, reparto: 'naranja' },
  { week: 3, phase: 'Ventas', title: 'Primeros AaaS cerrados ($250 setup + $250/mes). Pitch al final de cada demo web. Entrega: web 48h, agente 5-7 días', responsible: 'Martin', daysFromStart: 18, hours: 3, reparto: 'verde' },
  { week: 4, phase: 'Control', title: 'CIERRE MES 1: close rate, caja, MRR y la objeción que más se repite. Datos reales, no hipótesis', responsible: 'Martin', daysFromStart: 19, hours: 1, reparto: 'naranja' },
  { week: 5, phase: 'Control', title: 'GATE 1: close rate web ≥20% y AaaS ≥10% de las demos. Si no → corregir oferta/nicho (no más aguante)', responsible: 'Martin', daysFromStart: 25, hours: 0, reparto: 'verde', isGate: true },
  { week: 5, phase: 'Ventas', title: 'Upsell AaaS al 100% de compradores de web (misma llamada o reporte semanal). Meta 30-50% webs → AaaS', responsible: 'Martin', daysFromStart: 25, hours: 0, reparto: 'verde' },
  { week: 5, phase: 'Ventas', title: 'Mantener 15-20 contactos/día con guion corregido según objeciones reales. +4-6 AaaS', responsible: 'Martin', daysFromStart: 25, hours: 20, reparto: 'verde' },
  { week: 6, phase: 'Ventas', title: 'Referidos: pedir 2-3 contactos a cada cliente feliz (doctores y dueños se conocen). Meta 10 referidos/mes', responsible: 'Martin', daysFromStart: 32, hours: 0, reparto: 'verde' },
  { week: 8, phase: 'Control', title: 'CIERRE MES 2: MRR acumulado vs $1,000. Tablero y revisión con coach', responsible: 'Martin', daysFromStart: 46, hours: 1, reparto: 'naranja' },
  { week: 9, phase: 'Sistema', title: 'Proceso de venta 100% repetible: scripts finales + secuencia + carpeta de demos. "Un niño de 11 años podría ejecutarlo"', responsible: 'Martin', daysFromStart: 53, hours: 4, reparto: 'verde' },
  { week: 10, phase: 'Escala', title: 'Evaluar al amigo ($200) para agendar demos SOLO si volumen >20 demos/sem y close rate estable', responsible: 'Martin', daysFromStart: 60, hours: 1, reparto: 'verde' },
  { week: 11, phase: 'Control', title: 'GATE 2: MRR ≥$1,500 o caja mensual ≥$2,000 (MRR + ventas). Sí → consolidar. No → re-evaluar nicho', responsible: 'Martin', daysFromStart: 67, hours: 0, reparto: 'verde', isGate: true },
  { week: 12, phase: 'Control', title: 'Reporte final: qué funcionó, qué no, decisión Q4 (escalar Ecuador profundo o abrir otro nicho)', responsible: 'Martin', daysFromStart: 81, hours: 2, reparto: 'verde' },
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
    hours: a.hours,
    reparto: a.reparto,
  }));

// ---------------------------------------------------------------------------
// KPIs (hoja KPIs + documento principal) — objetivo + kill metric.
// ---------------------------------------------------------------------------

export interface KpiDef {
  key: string;
  label: string;
  target: number; // umbral para el veredicto ok/warn
  /** Etiqueta de objetivo en rango (p.ej. "75-100/sem"); se muestra si existe. */
  targetLabel?: string;
  display: 'number' | 'pct' | 'money';
  /**
   * Kill metric: 2 semanas seguidas por debajo de `threshold` = parar y
   * corregir ANTES de gastar más tiempo o plata. `mode: 'month2'` es el caso
   * especial del MRR (mes 2 con <$500 → re-evaluar todo).
   */
  kill: { threshold: number; text: string; mode: 'weeks' | 'month2' } | null;
}

export const KPI_DEFS: KpiDef[] = [
  { key: 'contactsWeek', label: 'Contactos por semana', target: 75, targetLabel: '75-100/sem', display: 'number', kill: { threshold: 40, text: 'Menos de 40/sem → no estás en la calle', mode: 'weeks' } },
  { key: 'demosWeek', label: 'Demos por semana', target: 15, targetLabel: '15-20/sem', display: 'number', kill: { threshold: 10, text: 'Menos de 10/sem → el gancho no funciona', mode: 'weeks' } },
  { key: 'closeWeb', label: 'Close rate web', target: 0.2, display: 'pct', kill: { threshold: 0.15, text: 'Menos de 15% → cambiar oferta/precio/nicho', mode: 'weeks' } },
  { key: 'closeAaaS', label: 'Close rate AaaS (sobre demos)', target: 0.1, display: 'pct', kill: { threshold: 0.05, text: 'Menos de 5% → refinar pitch o cambiar nicho', mode: 'weeks' } },
  { key: 'upsell', label: 'Upsell web → AaaS', target: 0.3, display: 'pct', kill: null },
  { key: 'mrr', label: 'MRR', target: 2000, targetLabel: 'M2 $1.000 · M3 $1.500-2.000', display: 'money', kill: { threshold: 500, text: 'Mes 2 con <$500 → re-evaluar todo', mode: 'month2' } },
  { key: 'incomeQuarter', label: 'Ingreso trimestral', target: 6700, targetLabel: '≥$2.000/mes', display: 'money', kill: null },
];

/** KPIs informativos (sin umbral/veredicto automático). */
export const INFO_KPIS: { label: string; text: string }[] = [
  { label: 'CAC', text: '~$0-5 en plata + 1-2h de tiempo por cierre (sin pauta pagada al inicio)' },
];
