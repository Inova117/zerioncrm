// ---------------------------------------------------------------------------
// Meta Conversions API — disparador OUTBOUND desde el CRM.
//
// Cuando un lead cambia de etapa, le avisamos a Meta vía la Edge Function
// `meta-capi` para que el algoritmo de ads aprenda a quién mostrar los anuncios
// (flujo "Qualified Leads" / CRM Conversions API). Esto NO trae leads — solo
// manda la señal de calidad del embudo hacia Meta.
//
// Reglas de diseño (importantes):
//   • FIRE-AND-FORGET: nunca hace await en el flujo del Kanban ni lanza. Un
//     fallo de Meta (o de red) no debe romper el mover de una tarjeta.
//   • NO-OP en modo mock: sin `supabase` (dev/demos) no hay a quién avisar.
//   • Allow-list de etapas: solo las etapas del embudo que Meta optimiza generan
//     evento. `frio`, `no-acepto` y `perdido` NO se envían.
// ---------------------------------------------------------------------------
import type { Temperature } from '../types';
import { supabase } from '../lib/supabaseClient';

/**
 * Mapa etapa CRM → nombre de evento de Meta. Debe mantenerse en sync con la
 * allow-list `ALLOWED_EVENTS` de supabase/functions/meta-capi/index.ts. Las
 * etapas que NO aparecen aquí no generan ningún evento hacia Meta.
 *
 *   nuevo    → Lead              (entra al embudo)
 *   tibio    → QualifiedLead     (mostró interés real)
 *   caliente → QualifiedLead     (negociando; misma señal de calidad)
 *   reunion  → MeetingScheduled  (agendó)
 *   cliente  → Purchase          (conversión — lo que más pesa para el algoritmo)
 */
const EVENT_BY_STAGE: Partial<Record<Temperature, string>> = {
  nuevo: 'Lead',
  tibio: 'QualifiedLead',
  caliente: 'QualifiedLead',
  reunion: 'MeetingScheduled',
  cliente: 'Purchase',
};

/** Evento de Meta para una etapa, o null si esa etapa no se reporta. */
export function metaEventForStage(t: Temperature): string | null {
  return EVENT_BY_STAGE[t] ?? null;
}

/**
 * Dispara (fire-and-forget) el evento de Conversions API por un cambio de etapa.
 * No hace await, no lanza y no bloquea: cualquier error se registra en consola
 * con un warning suave y se descarta. No-op en modo mock.
 */
export function notifyMetaStageChange(leadId: string, temperature: Temperature): void {
  if (!supabase) return; // modo mock / demo: no hay backend a quién avisar
  const eventName = metaEventForStage(temperature);
  if (!eventName) return; // etapa que no se reporta (frio, no-acepto, perdido)

  supabase.functions
    .invoke('meta-capi', {
      body: { leadId, eventName, eventTime: Math.floor(Date.now() / 1000) },
    })
    .then(({ error }) => {
      if (error) console.warn('[meta-capi] no se pudo enviar el evento a Meta:', error.message);
    })
    .catch((e) => console.warn('[meta-capi] error enviando el evento a Meta:', e));
}
