// ============================================================================
// feedback — feedback loop de la prospección automática.
// Convierte lo que Martín YA registra en el CRM (etapa del lead + encuesta
// post-llamada del Copilot) en métricas de rendimiento por nicho, con
// suavizado de Laplace para el arranque en frío (pocos datos → no sobre-reacciona).
// Lógica PURA (sin React/Supabase) → testeable con vitest.
// ============================================================================
import type { CallSurveyAnswers, Lead } from '../types';
import { nicheEntry, nicheFor } from './nicheCatalog';
import type { NichePrimary } from './nicheCatalog';

export interface NichePerformance {
  niche: string; // clave del catálogo, o industry crudo si no matchea
  label: string;
  primary: NichePrimary; // web | aaas | ambigua (del catálogo)
  leads: number;
  contacted: number; // salió de 'nuevo' (lo intentó contactar)
  demos: number; // vio la demo o más
  clients: number;
  lost: number;
  objections: Record<string, number>; // clave de objeción → conteo
  contactRate: number; // Laplace (contacted+1)/(leads+2)
  demoRate: number; // Laplace (demos+1)/(contacted+2)
  closeRate: number; // Laplace (clients+1)/(demos+2)
  priority: number; // 0-100: neutral 50, ajusta por evidencia y objeciones
}

/** Objeciones que son señal de "no necesita el servicio" (fit killer). */
const FIT_KILLERS = new Set(['ya-pagina', 'no-interesa', 'sobrino']);

/** Objeciones de fit que depriorizan el nicho. */
const FIT_PENALTY_PER = 8; // por objeción (hasta un techo)

const DEMO_STAGES = new Set(['demo-enviada', 'negociando', 'cliente', 'reactivacion']);

/** Suavizado de Laplace: (k+1)/(n+2) — nunca 0 ni sobre-confianza con pocos datos. */
const lap = (k: number, n: number): number => (k + 1) / (n + 2);

export function nichePerformance(
  leads: Lead[],
  surveys: Record<string, CallSurveyAnswers> = {}
): NichePerformance[] {
  const groups = new Map<string, NichePerformance>();

  for (const l of leads) {
    const entry = nicheEntry(l.industry ?? '');
    const key = entry?.key ?? (l.industry ?? 'otros').trim().toLowerCase();
    const primary = entry?.primary ?? nicheFor(l.industry ?? '');

    let g = groups.get(key);
    if (!g) {
      g = {
        niche: key,
        label: entry?.label ?? (l.industry || 'otros'),
        primary,
        leads: 0, contacted: 0, demos: 0, clients: 0, lost: 0,
        objections: {}, contactRate: 0, demoRate: 0, closeRate: 0, priority: 50,
      };
      groups.set(key, g);
    }

    g.leads++;
    if (l.temperature !== 'nuevo') g.contacted++;
    if (DEMO_STAGES.has(l.temperature)) g.demos++;
    if (l.temperature === 'cliente') g.clients++;
    if (l.temperature === 'perdido') g.lost++;

    const survey = surveys[l.id];
    if (survey?.objecion) {
      g.objections[survey.objecion] = (g.objections[survey.objecion] ?? 0) + 1;
    }
  }

  return [...groups.values()].map((g) => {
    g.contactRate = lap(g.contacted, g.leads);
    g.demoRate = lap(g.demos, g.contacted);
    g.closeRate = lap(g.clients, g.demos);

    // Evidencia de conversión: las tasas se comparan contra el neutral (0.5).
    const evidence =
      (g.closeRate - 0.5) * 40 +
      (g.demoRate - 0.5) * 30 +
      (g.contactRate - 0.5) * 10;

    const fitKillers = Object.entries(g.objections)
      .filter(([k]) => FIT_KILLERS.has(k))
      .reduce((sum, [, n]) => sum + n, 0);
    const fitPenalty = Math.min(30, fitKillers * FIT_PENALTY_PER);

    g.priority = Math.max(0, Math.min(100, 50 + evidence - fitPenalty));
    return g;
  });
}

/** Los n nichos de mayor prioridad (para el decisor). */
export function topNiches(perf: NichePerformance[], n: number): NichePerformance[] {
  return [...perf].sort((a, b) => b.priority - a.priority).slice(0, n);
}