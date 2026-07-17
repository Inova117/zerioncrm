// ============================================================================
// Copilot — el coach de ventas en tiempo real.
//
// Capa dual como todos los servicios:
//   • Supabase → Edge Function `copilot` (Claude, streaming; la API key vive
//     SOLO en el servidor). El cliente lee el stream y pinta token a token.
//   • Mock     → respuestas del playbook con streaming simulado, para
//     desarrollar/demo sin gastar un centavo.
//
// Tres modos: briefing (pre-llamada) · suggest (en vivo) · summary (al colgar).
// ============================================================================
import type { Lead, Temperature } from '../types';
import { supabase } from '../lib/supabaseClient';
import { detectObjection } from '../data/salesPlaybook';
import { settingsForPrompt } from '../lib/copilotSettings';

export interface SuggestArgs {
  lead: Lead;
  /** Transcripción reciente (últimos ~1500 chars). */
  transcript: string;
  /** Contexto del disparo: objeción detectada o pedido manual. */
  trigger?: string;
  /** Historial con el prospecto (llamadas/comentarios previos). */
  history?: string;
  /** Momento de la llamada detectado en el cliente ("label: mejor jugada"). */
  moment?: string;
  /** Estado estructurado: loops por objeción + números del prospecto. */
  callState?: string;
  /** Memoria del nicho (lecciones de llamadas anteriores). */
  memory?: string;
}

export interface CallSummary {
  summary: string;
  temperature: Temperature;
  nextAction: string;
}

export interface CallDebrief {
  /** Coaching accionable de ESTA llamada (bullets). */
  coaching: string;
  /** La memoria del nicho actualizada completa. */
  lessons: string;
}

export interface CopilotCallRecord {
  id: string;
  leadId: string;
  transcript: string;
  summary: string;
  temperature: string;
  nextAction: string;
  stats: string;
  coaching: string;
  createdAt: string;
}

export interface DebriefArgs {
  lead: Lead;
  transcript: string;
  stats: string;
  memory: string;
}

/** Ficha del lead como texto para los prompts (igual en mock y server). */
export function leadBrief(lead: Lead): string {
  const e = lead.enrichment;
  return [
    `Negocio: ${lead.company}`,
    lead.industry && `Rubro: ${lead.industry}`,
    lead.contactName && `Contacto: ${lead.contactName}`,
    e?.rating != null && `Google: ${e.rating}⭐ (${e.reviewCount ?? '?'} reseñas)`,
    lead.website ? `Sitio web: ${lead.website}` : 'SIN SITIO WEB (oportunidad principal: venderle la página)',
    e?.city && `Ciudad: ${e.city}`,
    lead.reason && `Contexto: ${lead.reason}`,
    lead.temperature !== 'nuevo' && `Etapa actual en el CRM: ${lead.temperature}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ===========================================================================
// Supabase — Edge Function con streaming
// ===========================================================================
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/copilot`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function callFn(
  body: Record<string, unknown>,
  onDelta?: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const { data: sess } = await supabase!.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error('Sesión expirada — vuelve a iniciar sesión.');

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Copilot respondió ${res.status}`);
  }

  // La función emite texto plano en chunks (ya des-SSE-ado en el servidor).
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onDelta?.(chunk);
  }
  return full;
}

// El playbook ya NO viaja desde el navegador: vive en el servidor (generado
// por npm run sync:playbook). Cada request baja de ~58KB a ~2-5KB de subida.
const supaBriefing = (lead: Lead, history: string, memory: string, onDelta?: (t: string) => void) =>
  callFn(
    { mode: 'briefing', lead: leadBrief(lead), history, memory, settings: settingsForPrompt() },
    onDelta
  );

const supaSuggest = (args: SuggestArgs, onDelta: (t: string) => void, signal?: AbortSignal) =>
  callFn(
    {
      mode: 'suggest',
      lead: leadBrief(args.lead),
      // Solo el intercambio reciente: menos tokens sin cache = menos TTFT.
      transcript: args.transcript.slice(-3000),
      trigger: args.trigger ?? '',
      history: args.history ?? '',
      moment: args.moment ?? '',
      callState: args.callState ?? '',
      memory: args.memory ?? '',
      settings: settingsForPrompt(),
    },
    onDelta,
    signal
  );

// Precalienta el cache del modelo de suggest (fire-and-forget). El cache de
// Anthropic es por modelo: el briefing (Opus) no calienta el de Haiku.
const supaWarm = () => {
  callFn({ mode: 'warm' }).catch(() => {
    /* best-effort: si falla, la primera sugerencia solo será más lenta */
  });
};
const mockWarm = () => {
  /* mock: nada que calentar */
};
export const copilotWarm: () => void = supabase ? supaWarm : mockWarm;

// ===========================================================================
// Debrief post-llamada: coaching + memoria del nicho actualizada
// ===========================================================================
async function supaDebrief(args: DebriefArgs): Promise<CallDebrief> {
  const raw = await callFn({
    mode: 'debrief',
    lead: leadBrief(args.lead),
    transcript: args.transcript.slice(-6000),
    stats: args.stats,
    memory: args.memory,
    settings: settingsForPrompt(),
  });
  try {
    const j = JSON.parse(raw) as CallDebrief;
    if (typeof j.coaching === 'string' && typeof j.lessons === 'string') return j;
  } catch {
    /* cae al fallback */
  }
  return { coaching: raw, lessons: args.memory };
}

async function mockDebrief(args: DebriefArgs): Promise<CallDebrief> {
  await new Promise((r) => setTimeout(r, 500));
  const coaching = [
    '• Bien: mantuviste la llamada viva tras la primera objeción.',
    '• Te faltó cuantificar: cuando dijo su problema, la jugada era "¿cuántos clientes al mes se le van por eso?"',
    '• Próxima llamada: cierra SIEMPRE con alternativa de dos fechas, nunca con "¿le interesa?".',
  ].join('\n');
  const nueva = `- ${new Date().toLocaleDateString()}: la objeción más frecuente sigue siendo el precio; ancla primero la pérdida mensual.`;
  const lessons = `${args.memory}\n${nueva}`.trim().slice(-3500);
  return { coaching, lessons };
}

export const copilotDebrief: (args: DebriefArgs) => Promise<CallDebrief> =
  supabase ? supaDebrief : mockDebrief;

// ===========================================================================
// Memoria del nicho (lecciones acumuladas) + llamadas guardadas
// ===========================================================================
const MEMORY_KEY = 'zerioncrm:copilotMemory';
const CALLS_KEY = 'zerioncrm:copilotCalls';

async function supaGetMemory(): Promise<string> {
  const { data } = await supabase!.from('copilot_memory').select('memory').maybeSingle();
  return data?.memory ?? '';
}
async function supaSaveMemory(memory: string): Promise<void> {
  const { data: u } = await supabase!.auth.getUser();
  if (!u.user) return;
  await supabase!
    .from('copilot_memory')
    .upsert({ user_id: u.user.id, memory, updated_at: new Date().toISOString() });
}
async function mockGetMemory(): Promise<string> {
  return localStorage.getItem(MEMORY_KEY) ?? '';
}
async function mockSaveMemory(memory: string): Promise<void> {
  localStorage.setItem(MEMORY_KEY, memory);
}
export const getCopilotMemory: () => Promise<string> = supabase ? supaGetMemory : mockGetMemory;
export const saveCopilotMemory: (m: string) => Promise<void> = supabase ? supaSaveMemory : mockSaveMemory;

type NewCallRecord = Omit<CopilotCallRecord, 'id' | 'createdAt'>;

async function supaSaveCall(rec: NewCallRecord): Promise<void> {
  const { data: u } = await supabase!.auth.getUser();
  if (!u.user) return;
  await supabase!.from('copilot_calls').insert({
    lead_id: rec.leadId,
    user_id: u.user.id,
    transcript: rec.transcript,
    summary: rec.summary,
    temperature: rec.temperature,
    next_action: rec.nextAction,
    stats: rec.stats,
    coaching: rec.coaching,
  });
}
async function supaListCalls(leadId: string): Promise<CopilotCallRecord[]> {
  const { data } = await supabase!
    .from('copilot_calls')
    .select('id, lead_id, transcript, summary, temperature, next_action, stats, coaching, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    leadId: r.lead_id as string,
    transcript: (r.transcript as string) ?? '',
    summary: (r.summary as string) ?? '',
    temperature: (r.temperature as string) ?? '',
    nextAction: (r.next_action as string) ?? '',
    stats: (r.stats as string) ?? '',
    coaching: (r.coaching as string) ?? '',
    createdAt: r.created_at as string,
  }));
}
async function mockSaveCall(rec: NewCallRecord): Promise<void> {
  const all = JSON.parse(localStorage.getItem(CALLS_KEY) ?? '[]') as CopilotCallRecord[];
  all.unshift({ ...rec, id: `call-${Date.now()}`, createdAt: new Date().toISOString() });
  localStorage.setItem(CALLS_KEY, JSON.stringify(all.slice(0, 50)));
}
async function mockListCalls(leadId: string): Promise<CopilotCallRecord[]> {
  const all = JSON.parse(localStorage.getItem(CALLS_KEY) ?? '[]') as CopilotCallRecord[];
  return all.filter((c) => c.leadId === leadId).slice(0, 10);
}
export const saveCopilotCall: (rec: NewCallRecord) => Promise<void> =
  supabase ? supaSaveCall : mockSaveCall;
export const listCopilotCalls: (leadId: string) => Promise<CopilotCallRecord[]> =
  supabase ? supaListCalls : mockListCalls;

async function supaSummary(lead: Lead, transcript: string): Promise<CallSummary> {
  const raw = await callFn({
    mode: 'summary',
    lead: leadBrief(lead),
    playbook: '', // el resumen no necesita el playbook completo
    transcript,
  });
  try {
    const j = JSON.parse(raw) as CallSummary;
    if (j.summary && j.temperature) return j;
  } catch {
    /* cae al fallback */
  }
  return { summary: raw, temperature: lead.temperature, nextAction: '' };
}

// ===========================================================================
// Mock — playbook + streaming simulado (demo sin API)
// ===========================================================================
const streamOut = async (text: string, onDelta?: (t: string) => void): Promise<string> => {
  if (!onDelta) return text;
  const words = text.split(' ');
  for (let i = 0; i < words.length; i += 3) {
    onDelta(words.slice(i, i + 3).join(' ') + ' ');
    await new Promise((r) => setTimeout(r, 40));
  }
  return text;
};

async function mockBriefing(lead: Lead, history: string, _memory: string, onDelta?: (t: string) => void): Promise<string> {
  const e = lead.enrichment;
  const noWeb = !lead.website.trim();
  const settings = settingsForPrompt();
  const histLine = history.trim()
    ? [`**Ya tienes historia con este prospecto:** ${history.trim()}`, 'Retómala: no arranques de cero, referénciala ("La vez pasada quedamos en…").', '']
    : [];
  const settingsLine = settings ? [`**Tu oferta (úsala tal cual):** ${settings.split('\n')[0]}`, ''] : [];
  const text = [
    ...settingsLine,
    ...histLine,
    `**Ángulo de apertura:** "${lead.contactName || 'Hola'}, los encontré en Google Maps — ${
      e?.rating != null ? `tienen ${e.rating}⭐ con ${e.reviewCount} reseñas, se nota que trabajan bien` : 'vi su negocio y me llamó la atención'
    }. ${noWeb ? 'Lo curioso: NO tienen página web, y con esa reputación están dejando clientes en la mesa.' : 'Revisé su página y hay 3 cosas que les traerían más clientes.'}"`,
    '',
    '**Objeciones probables:**',
    '1. "No me interesa" → dato suyo + 20 segundos: "7 de cada 10 buscan en Google antes de llamar."',
    '2. "Está caro" → ¿cuánto vale un cliente? Un cliente/mes y la página se pagó sola.',
    `3. "${noWeb ? 'Con Facebook me basta' : 'Ya tengo quien me la maneja'}" → ${
      noWeb ? 'redes = quien ya te conoce; Google = quien te necesita HOY.' : 'revisión gratis con 3 mejoras concretas.'
    }`,
    '',
    '**Meta de la llamada:** agendar demo del diseño (cierre alternativo: ¿mañana 10am o jueves 3pm?). Recuerda: 4 primeros segundos con energía, acuerda antes de responder, y NUNCA cuelgues sin fecha y hora.',
  ].join('\n');
  await new Promise((r) => setTimeout(r, 400));
  return streamOut(text, onDelta);
}

async function mockSuggest(args: SuggestArgs, onDelta: (t: string) => void, _signal?: AbortSignal): Promise<string> {
  const card = args.trigger ? detectObjection(args.trigger) : detectObjection(args.transcript.slice(-300));
  let text: string;
  if (card) {
    text = `**Dile esto:** ${card.response}\n\n*(${card.why})*`;
  } else if (args.moment) {
    text = `**${args.moment.split(':')[0]}** — ${args.moment.split(':').slice(1).join(':').trim()}`;
  } else if (/cuanto (cuesta|vale|sale)|precio|que incluye|cuanto se demora/i.test(args.transcript.slice(-200))) {
    text =
      '🟢 **SEÑAL DE COMPRA** — deja de presentar y cierra: "Le propongo esto: le preparo el diseño de muestra y lo vemos el jueves. Si le encanta, arrancamos con el plan de $X al mes. ¿Jueves a las 10 o a las 4?"';
  } else {
    text =
      '**Siguiente pregunta (SPIN):** "¿Hoy cómo les llega la gente nueva — puro boca a boca, o también por internet?" Escucha su respuesta y cuantifica: ¿cuántos clientes al mes? ¿cuánto vale cada uno? El que pregunta, controla.';
  }
  await new Promise((r) => setTimeout(r, 350));
  return streamOut(text, onDelta);
}

async function mockSummary(lead: Lead, transcript: string): Promise<CallSummary> {
  await new Promise((r) => setTimeout(r, 600));
  const t = transcript.toLowerCase();
  let temperature: Temperature = 'frio';
  let nextAction = 'Volver a llamar en 3 días con el dato del negocio.';
  if (/jueves|manana|lunes|martes|miercoles|viernes|agend|cita|reunion|demo/i.test(t)) {
    temperature = 'caliente';
    nextAction = 'Preparar el diseño de muestra y confirmar la cita agendada.';
  } else if (/interes|cuanto|precio|informacion|whatsapp/i.test(t)) {
    temperature = 'tibio';
    nextAction = 'Enviar info puntual por WhatsApp y llamar mañana a la misma hora.';
  }
  return {
    summary: `Llamada con ${lead.company}. ${transcript ? `Se conversó: "${transcript.slice(0, 220)}${transcript.length > 220 ? '…' : ''}"` : 'Sin transcripción registrada.'}`,
    temperature,
    nextAction,
  };
}

// ===========================================================================
export const copilotBriefing: (
  lead: Lead,
  history: string,
  memory: string,
  onDelta?: (t: string) => void
) => Promise<string> = supabase ? supaBriefing : mockBriefing;
export const copilotSuggest: (
  args: SuggestArgs,
  onDelta: (t: string) => void,
  signal?: AbortSignal
) => Promise<string> = supabase ? supaSuggest : mockSuggest;
export const copilotSummary: (lead: Lead, transcript: string) => Promise<CallSummary> =
  supabase ? supaSummary : mockSummary;
