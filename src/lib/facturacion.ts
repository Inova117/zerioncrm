// ============================================================================
// FACTURACIÓN POR PROXY — inferir si un negocio está ESTABLECIDO (puede pagar
// el ticket de $500/mes + $300-400 de pauta) a partir de señales observables.
//
// La facturación REAL no es pública: no existe "esta empresa factura $X".
// Entonces se estima con variables proxy que sí se pueden scrapear/verificar:
//   empleados (LinkedIn) · sucursales · clientes/alumnos · reseñas · antigüedad.
//
// ⚠️ Calibración INICIAL (umbrales documentados). NO es un dato de facturación,
// es una heurística de prospección. Se ajusta con datos reales de cierre.
// ============================================================================
import type { ProspectoSenales, NivelFacturacion, ProspectoTechnical } from '../types';

// --- puntos 0-100 por señal (umbrales de calibración inicial) ---------------
function ptsEmpleados(n: number): number {
  if (n >= 20) return 100;
  if (n >= 10) return 80;
  if (n >= 5) return 60;
  if (n >= 3) return 40;
  if (n >= 1) return 20;
  return 0;
}
function ptsSucursales(n: number): number {
  if (n >= 4) return 85;
  if (n >= 3) return 65;
  if (n >= 2) return 45;
  return 20;
}
function ptsClientes(n: number): number {
  if (n >= 1000) return 100;
  if (n >= 500) return 90;
  if (n >= 200) return 75;
  if (n >= 100) return 60;
  if (n >= 50) return 45;
  if (n >= 10) return 25;
  return 10;
}
function ptsResenas(n: number): number {
  if (n >= 500) return 95;
  if (n >= 200) return 80;
  if (n >= 50) return 65;
  if (n >= 10) return 40;
  return 15;
}
function ptsAntiguedad(n: number): number {
  if (n >= 21) return 80;
  if (n >= 11) return 60;
  if (n >= 3) return 40;
  return 15;
}

/** Cuántas señales concretas tiene el prospecto (nº de variables informadas). */
export function nSenales(s: ProspectoSenales | undefined | null): number {
  if (!s) return 0;
  return [
    s.empleados, s.sucursales, s.clientes, s.resenas, s.antiguedad,
  ].filter((v) => typeof v === 'number').length;
}

/** Score de facturación (0-100) = promedio de las señales disponibles.
 *  null si no hay NINGUNA → no podemos opinar (sin-datos). */
export function facturaScore(s: ProspectoSenales | undefined | null): number | null {
  if (!s) return null;
  const parts: number[] = [];
  if (typeof s.empleados === 'number') parts.push(ptsEmpleados(s.empleados));
  if (typeof s.sucursales === 'number') parts.push(ptsSucursales(s.sucursales));
  if (typeof s.clientes === 'number') parts.push(ptsClientes(s.clientes));
  if (typeof s.resenas === 'number') parts.push(ptsResenas(s.resenas));
  if (typeof s.antiguedad === 'number') parts.push(ptsAntiguedad(s.antiguedad));
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Una señal "dominante" por sí sola ya prueba escala (mucha gente/sedes/clientes). */
function dominante(s: ProspectoSenales): boolean {
  return (
    (s.clientes ?? 0) >= 500 ||
    (s.sucursales ?? 0) >= 3 ||
    (s.empleados ?? 0) >= 15 ||
    (s.resenas ?? 0) >= 200
  );
}

/** Veredicto de facturación → ¿puede pagar el ticket ($500 + $300-400 pauta)?
 *  - sostiene: score ≥70 con evidencia suficiente (≥2 señales, o 1 dominante).
 *  - probable: score 40-69 (o alto pero con poca evidencia, p.ej. solo antigüedad).
 *  - no: score <40.
 *  - sin-datos: sin señales. */
export function nivelFacturacion(s: ProspectoSenales | undefined | null): NivelFacturacion {
  const sc = facturaScore(s);
  if (sc === null) return 'sin-datos';
  const n = nSenales(s);
  if (sc >= 70 && (n >= 2 || dominante(s!))) return 'sostiene';
  if (sc >= 40) return 'probable';
  return 'no';
}

export const NIVEL_FACTURACION: Record<
  NivelFacturacion,
  { label: string; chip: string; dot: string; desc: string }
> = {
  sostiene: {
    label: 'Sostiene el ticket',
    chip: 'bg-emerald-50 text-emerald-600',
    dot: 'bg-emerald-500',
    desc: 'Factura lo suficiente para $500/mes + pauta, holgado',
  },
  probable: {
    label: 'Probable',
    chip: 'bg-amber-50 text-amber-600',
    dot: 'bg-amber-500',
    desc: 'Candidato: hay señales pero falta verificar',
  },
  no: {
    label: 'No',
    chip: 'bg-surface-100 text-surface-500',
    dot: 'bg-surface-400',
    desc: 'Probablemente no puede sostener el ticket',
  },
  'sin-datos': {
    label: 'Sin datos',
    chip: 'bg-surface-100 text-surface-400',
    dot: 'bg-surface-300',
    desc: 'Sin señales — verificar manualmente',
  },
};

/** Hueco digital (¿nos necesita?) a partir del análisis técnico. 0-100; null sin datos. */
export function huecoScore(technical: ProspectoTechnical | null | undefined): number | null {
  if (!technical) return null;
  let s = 0;
  if (technical.accessible === false) s += 35;
  if (technical.hasMetaDescription === false) s += 35;
  if (technical.hasViewport === false) s += 15;
  return Math.min(100, s);
}

/** Score global del prospecto (0-100) = facturación (40%) + hueco (35%) + alcance (25%).
 *  Para autocompletar un prospecto desde el scraper sin pedir nada a mano. Los ejes
 *  desconocidos caen a 40 (neutro) para no castigar ni inflar por falta de datos. */
export function scoreProspecto(
  senales: ProspectoSenales | undefined | null,
  technical: ProspectoTechnical | null | undefined,
  hasContact: boolean
): number {
  const factura = facturaScore(senales) ?? 40;
  const hueco = huecoScore(technical) ?? 40;
  const reach = hasContact ? 80 : 30;
  return Math.round(0.4 * factura + 0.35 * hueco + 0.25 * reach);
}

/** Las señales informadas, con su lectura humana (para el detalle del prospecto). */
export function senalesDetalle(s: ProspectoSenales | undefined | null): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (typeof s.empleados === 'number') out.push(`${s.empleados} empleado${s.empleados === 1 ? '' : 's'}`);
  if (typeof s.sucursales === 'number') out.push(`${s.sucursales} sede${s.sucursales === 1 ? '' : 's'}`);
  if (typeof s.clientes === 'number') out.push(`${s.clientes} cliente${s.clientes === 1 ? '' : 's'}/alumnos`);
  if (typeof s.resenas === 'number') out.push(`${s.resenas} reseñas`);
  if (typeof s.antiguedad === 'number') out.push(`${s.antiguedad} años`);
  return out;
}
