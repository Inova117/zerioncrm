// ============================================================================
// decider — el decisor diario de prospección (lógica PURA, testeada).
// Combina las tres piezas: feedback (qué niche convierte), saturación (qué está
// gastado) y catálogos (qué ciudades/nichos existen) para elegir EL objetivo
// de la próxima corrida y explicar por qué.
//
// En arranque en frío (sin datos de conversión) cae al orden por defecto del
// catálogo. El `primary` es informativo: el servicio final de cada lead lo
// decide el scoring dual en el momento del análisis.
// ============================================================================
import type { NichePerformance } from './feedback';
import type { Saturation } from './saturation';
import { nextTarget } from './saturation';
import type { CityEntry } from './cityCatalog';
import { defaultCityOrder } from './cityCatalog';
import { nicheEntry } from './nicheCatalog';
import type { NichePrimary } from './nicheCatalog';

export interface Decision {
  nicheKey: string;
  nicheLabel: string;
  cityKey: string;
  cityLabel: string;
  primary: NichePrimary; // web | aaas | ambigua (informativo)
  priority: number; // prioridad del nicho elegido (50 en cold start)
  reason: string; // el porqué, legible para el reporte diario
}

export interface DecideInput {
  /** Rendimiento por nicho (feedback). Vacío en arranque en frío. */
  perf: NichePerformance[];
  /** Claves de nichos en orden por defecto (catálogo) para el cold start. */
  fallbackNiches: string[];
  /** Ciudades (tier 1 → 3). Por defecto, el catálogo completo. */
  cities?: CityEntry[];
  /** Saturación por `${nicheKey}:${cityKey}`. */
  saturation: Record<string, Saturation>;
}

export function decide(input: DecideInput): Decision | null {
  const cities = input.cities ?? defaultCityOrder();
  const cityOrder = cities.map((c) => c.key);

  // Orden de nichos: feedback (prioridad desc) + los del catálogo sin datos al final.
  const byPriority = [...input.perf].sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const nicheOrder: string[] = [];
  for (const p of byPriority) {
    nicheOrder.push(p.niche);
    seen.add(p.niche);
  }
  for (const key of input.fallbackNiches) {
    if (!seen.has(key)) nicheOrder.push(key);
  }
  if (!nicheOrder.length) return null;

  const target = nextTarget(cityOrder, nicheOrder, input.saturation);
  if (!target) return null; // todo saturado → rota a otro país

  const perfEntry = input.perf.find((p) => p.niche === target.nicheKey);
  const city = cities.find((c) => c.key === target.cityKey);
  const entry = nicheEntry(target.nicheKey) ?? perfEntry;

  const priority = perfEntry ? Math.round(perfEntry.priority) : 50;
  const primary: NichePrimary = entry?.primary ?? perfEntry?.primary ?? 'web';
  const cityLabel = city?.label ?? target.cityKey;

  const reason = perfEntry
    ? `Elegí ${entry?.label ?? target.nicheKey} en ${cityLabel}: nicho de mayor prioridad (${priority}) no saturado.`
    : `Elegí ${entry?.label ?? target.nicheKey} en ${cityLabel}: arranque en frío (sin datos de conversión), orden por defecto del catálogo.`;

  return {
    nicheKey: target.nicheKey,
    nicheLabel: entry?.label ?? target.nicheKey,
    cityKey: target.cityKey,
    cityLabel,
    primary,
    priority,
    reason,
  };
}