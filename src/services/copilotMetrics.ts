// ============================================================================
// Métricas del Copilot — los números con los que se gestiona un equipo de venta.
//
// El embudo del modelo DEMO-FIRST en dos toques:
//
//   llamadas → CONTACTO (habló con el dueño)  → OFERTA (llegó a presentar)
//            → HORA AMARRADA (T1 ganado)      → CIERRE + CASH (T2 ganado)
//
// Cada tasa se mide contra la etapa ANTERIOR, no contra el total: así el
// número señala QUÉ eslabón está roto en vez de dar un promedio que no
// acciona nada. Si la tasa de contacto está bien y la de oferta mal, el
// problema es la apertura — no los leads.
//
// Regla dura: solo se cuentan llamadas con `outcome` (las anteriores al
// dashboard no tienen datos estructurados y meterlas ensuciaría las tasas).
// ============================================================================
import type { CallOutcome, CopilotCallRecord } from './copilotService';

export interface FunnelStep {
  key: 'llamadas' | 'contacto' | 'oferta' | 'hora' | 'cierre';
  label: string;
  hint: string;
  count: number;
  /** % sobre la etapa anterior (la conversión de ESTE eslabón). */
  rate: number | null;
}

export interface AperturaSplit {
  apertura: 'A' | 'B';
  llamadas: number;
  contacto: number;
  oferta: number;
  hora: number;
  cierre: number;
  /** % de llamadas que terminaron con la hora amarrada (el objetivo del T1). */
  horaRate: number | null;
}

export interface ObjecionStat {
  id: string;
  /** Veces que sonó en total. */
  veces: number;
  /** En cuántas llamadas apareció. */
  llamadas: number;
  /** % de esas llamadas que igual terminaron con hora amarrada o cierre. */
  superadaRate: number | null;
}

export interface CopilotMetrics {
  /** Llamadas con datos estructurados (la base de todo el cálculo). */
  total: number;
  /** Llamadas registradas SIN outcome (previas al dashboard) — se informan. */
  sinDatos: number;
  funnel: FunnelStep[];
  cashCollected: number;
  ticketPromedio: number;
  /** Minutos totales al teléfono. */
  minutos: number;
  /** Cash por hora de teléfono — el número que dice si el canal vale la pena. */
  cashPorHora: number | null;
  aperturas: AperturaSplit[];
  objeciones: ObjecionStat[];
  /** Los números del prospecto que el coach logró capturar (calidad del descubrimiento). */
  conMatematica: number;
}

const pctOf = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 100) : null;

/** Las llamadas medibles: las que traen outcome estructurado. */
export function measurable(calls: CopilotCallRecord[]): CallOutcome[] {
  return calls.map((c) => c.outcome).filter((o): o is CallOutcome => Boolean(o));
}

export function computeMetrics(calls: CopilotCallRecord[]): CopilotMetrics {
  const outcomes = measurable(calls);
  const total = outcomes.length;
  const sinDatos = calls.length - total;

  const contacto = outcomes.filter((o) => o.contacto).length;
  const oferta = outcomes.filter((o) => o.llegoAOferta).length;
  const hora = outcomes.filter((o) => o.horaAmarrada).length;
  const cierre = outcomes.filter((o) => o.cerrado).length;

  const cashCollected = outcomes.reduce((s, o) => s + (o.cashCollected || 0), 0);
  const minutos = outcomes.reduce((s, o) => s + (o.durationMin || 0), 0);

  const funnel: FunnelStep[] = [
    {
      key: 'llamadas',
      label: 'Llamadas',
      hint: 'Marcadas con el copilot',
      count: total,
      rate: null,
    },
    {
      key: 'contacto',
      label: 'Contacto',
      hint: 'Hablaste con el dueño',
      count: contacto,
      rate: pctOf(contacto, total),
    },
    {
      key: 'oferta',
      label: 'Oferta',
      hint: 'Llegaste a presentar',
      count: oferta,
      rate: pctOf(oferta, contacto),
    },
    {
      key: 'hora',
      label: 'Hora amarrada',
      hint: 'Toque 1 ganado',
      count: hora,
      rate: pctOf(hora, oferta),
    },
    {
      key: 'cierre',
      label: 'Cierre',
      hint: 'Toque 2: pagó',
      count: cierre,
      rate: pctOf(cierre, hora),
    },
  ];

  // A/B de aperturas: qué variante amarra más horas (el objetivo real del T1).
  const aperturas: AperturaSplit[] = (['A', 'B'] as const).map((v) => {
    const sub = outcomes.filter((o) => o.apertura === v);
    return {
      apertura: v,
      llamadas: sub.length,
      contacto: sub.filter((o) => o.contacto).length,
      oferta: sub.filter((o) => o.llegoAOferta).length,
      hora: sub.filter((o) => o.horaAmarrada).length,
      cierre: sub.filter((o) => o.cerrado).length,
      horaRate: pctOf(sub.filter((o) => o.horaAmarrada).length, sub.length),
    };
  });

  // Objeciones: cuáles suenan más y cuáles se están superando de verdad.
  const objMap = new Map<string, { veces: number; llamadas: number; superadas: number }>();
  for (const o of outcomes) {
    for (const [id, n] of Object.entries(o.objeciones ?? {})) {
      const cur = objMap.get(id) ?? { veces: 0, llamadas: 0, superadas: 0 };
      cur.veces += n;
      cur.llamadas += 1;
      if (o.horaAmarrada || o.cerrado) cur.superadas += 1;
      objMap.set(id, cur);
    }
  }
  const objeciones: ObjecionStat[] = [...objMap.entries()]
    .map(([id, v]) => ({
      id,
      veces: v.veces,
      llamadas: v.llamadas,
      superadaRate: pctOf(v.superadas, v.llamadas),
    }))
    .sort((a, b) => b.veces - a.veces);

  return {
    total,
    sinDatos,
    funnel,
    cashCollected,
    ticketPromedio: cierre > 0 ? Math.round(cashCollected / cierre) : 0,
    minutos,
    cashPorHora: minutos > 0 ? Math.round(cashCollected / (minutos / 60)) : null,
    aperturas,
    objeciones,
    conMatematica: outcomes.filter((o) => o.ticket != null && o.perdidos != null).length,
  };
}
