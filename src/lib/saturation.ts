// ============================================================================
// saturation — saturación y rotación de nichos+ciudades.
// Decide cuándo un nicho+ciudad está "gastado" (cap o rendimiento decreciente)
// y cuál es el siguiente target no saturado. Lógica PURA → testeable con vitest.
//
// El decisor (Fase D) calcula `extracted`/`lastFound`/`lastDuplicates` desde
// las tablas reales (lead_discoveries + lead_searches) y llama a estas reglas.
// ============================================================================

export interface SaturationInput {
  /** Negocios ya extraídos (dedup) de este nicho+ciudad. */
  extracted: number;
  /** Nuevos en la última corrida (tras dedupe). */
  lastFound: number;
  /** Duplicados en la última corrida (ya los habías visto). */
  lastDuplicates: number;
}

export interface Saturation {
  extracted: number;
  /** Proporción de nuevos sobre intentos (0..1; 1 si no hubo última corrida). */
  newRate: number;
  saturated: boolean;
  reason: 'pool-cap' | 'diminishing' | null;
}

export interface SaturationOptions {
  cap?: number;
  newRateMin?: number;
}

export const DEFAULT_CAP = 150; // leads máximos por nicho+ciudad
export const DEFAULT_NEW_RATE_MIN = 0.4; // debajo de esto, el pool se agotó

export function saturation(
  input: SaturationInput,
  opts: SaturationOptions = {}
): Saturation {
  const cap = opts.cap ?? DEFAULT_CAP;
  const newRateMin = opts.newRateMin ?? DEFAULT_NEW_RATE_MIN;

  const attempts = input.lastFound + input.lastDuplicates;
  const newRate = attempts > 0 ? input.lastFound / attempts : 1;

  const byCap = input.extracted >= cap;
  const byDiminishing =
    input.lastDuplicates > 0 && attempts > 0 && newRate < newRateMin;

  return {
    extracted: input.extracted,
    newRate,
    saturated: byCap || byDiminishing,
    reason: byCap ? 'pool-cap' : byDiminishing ? 'diminishing' : null,
  };
}

export interface Target {
  nicheKey: string;
  cityKey: string;
}

/**
 * Rotación: recorre ciudades en orden (tier) y, dentro de cada una, nichos por
 * prioridad (el llamador ya los ordena). Devuelve el primer objetivo no
 * saturado, o null si todo está gastado (se rota a otro país).
 */
export function nextTarget(
  cityOrder: string[], // ['quito', 'guayaquil', ...] (tier 1 → 3)
  nicheOrder: string[], // ['clinicas', 'abogados', ...] (prioridad desc)
  sat: Record<string, Saturation>
): Target | null {
  for (const cityKey of cityOrder) {
    for (const nicheKey of nicheOrder) {
      const key = `${nicheKey}:${cityKey}`;
      const s = sat[key];
      if (!s || !s.saturated) return { nicheKey, cityKey };
    }
  }
  return null;
}