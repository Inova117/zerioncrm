// ============================================================================
// Copilot — el coach de ventas en tiempo real.
//
// Capa dual como todos los servicios:
//   • Supabase → Edge Function `copilot` (DeepSeek vía OpenRouter, streaming;
//     la API key vive SOLO en el servidor). El cliente lee el stream y pinta
//     token a token.
//   • Mock     → respuestas del playbook con streaming simulado, para
//     desarrollar/demo sin gastar un centavo.
//
// Tres modos: briefing (pre-llamada) · suggest (en vivo) · summary (al colgar).
// ============================================================================
import type { CallSurveyAnswers, Lead, Temperature } from '../types';
import { supabase } from '../lib/supabaseClient';
import { detectObjection } from '../data/salesPlaybook';
import { aperturaGuionMock } from '../data/playbook/aperturaSpec';
import { settingsForPrompt, getCopilotSettings, fillPrecios } from '../lib/copilotSettings';
import { surveyLabel } from '../data/callSurvey';

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
  /** Nombre de pila del vendedor logueado — override a "Martín" del playbook. */
  vendor?: string;
  /** Guion específico de ESTE prospecto (lead.script). Prioridad máxima: el
   *  coach lo respeta palabra por palabra sobre sus jugadas del playbook. */
  script?: string;
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
  /** Mensaje de WhatsApp de seguimiento listo para enviar ('' = mejor no escribir). */
  whatsapp?: string;
}

/**
 * El resultado ESTRUCTURADO de una llamada — `stats` es la línea para LEER,
 * esto es lo que se puede MEDIR. Es la materia prima del dashboard: sin esto
 * no hay close rate, no hay cash cobrado y no hay caso de estudio.
 *
 * El embudo del modelo demo-first en dos toques:
 *   llamada → contacto (habló con el dueño) → oferta (presentó)
 *           → hora amarrada (T1 ganado) → cerrado + cash (T2 ganado)
 */
export interface CallOutcome {
  /** Variante de apertura de esta llamada (la prueba A/B). */
  apertura: 'A' | 'B';
  durationMin: number;
  /** Habló con el DUEÑO (no se quedó en la gatekeeper ni colgaron de una). */
  contacto: boolean;
  /** Llegó a presentar la oferta (pitch/precio/señal de compra/cierre). */
  llegoAOferta: boolean;
  /** T1 ganado: aceptó ver la página Y dio la hora a la que la vería. */
  horaAmarrada: boolean;
  /** T2 ganado: el pago quedó confirmado en esta llamada. */
  cerrado: boolean;
  /** $ realmente cobrado en esta llamada (0 si no cerró). */
  cashCollected: number;
  /** Objeciones que sonaron: id de battlecard → veces. */
  objeciones: Record<string, number>;
  /** Números que soltó el prospecto (el ancla de la matemática del dolor). */
  ticket: number | null;
  perdidos: number | null;
  /** Ruta de momentos por id, en orden. */
  momentos: string[];
  /** Encuesta post-llamada (reporte manual del vendedor). null = no respondida. */
  survey: CallSurveyAnswers | null;
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
  /** null en llamadas anteriores al dashboard (jul 2026): se ignoran al medir. */
  outcome: CallOutcome | null;
}

export interface DebriefArgs {
  lead: Lead;
  transcript: string;
  stats: string;
  memory: string;
  /** Nombre de pila del vendedor logueado — firma el WhatsApp con SU nombre. */
  vendor?: string;
  /** Guion específico de ESTE prospecto (para evaluar si se siguió). */
  script?: string;
}

/** Semáforo de la ficha — dosifica qué se puede prometer (LA DOSIS DE LA PROMESA
 *  del playbook): 🟢 clientela visible = se puede prometer resultado y garantía
 *  completa; 🟡 = solo ver-antes-de-pagar, jamás cifras de clientes. */
export function leadSemaforo(lead: Lead): { verde: boolean; linea: string } {
  const e = lead.enrichment;
  const verde = e?.rating != null && e.rating >= 4.0 && (e.reviewCount ?? 0) >= 10;
  return {
    verde,
    linea: verde
      ? 'Semáforo: 🟢 clientela visible (10+ reseñas, buen rating) — puedes prometer resultado y usar la garantía completa'
      : 'Semáforo: 🟡 poca clientela visible o ficha incompleta — promete SOLO ver-antes-de-pagar y trabajo-hasta-que-quede; JAMÁS cifras de clientes ni plazos de resultados',
  };
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
    leadSemaforo(lead).linea,
  ]
    .filter(Boolean)
    .join('\n');
}

// ===========================================================================
// Reporte SIN transcripción — la encuesta manual del vendedor reemplaza al
// análisis del LLM cuando la escucha falló o quedó vacía (el mic en altavoz es
// frágil: es el caso real que motivó la encuesta). El desenlace mapea directo
// a la temperatura del pipeline — la MISMA rúbrica que el summary por LLM.
// ===========================================================================
const DESENLACE_TO_TEMP: Record<string, Temperature> = {
  cliente: 'cliente',
  reunion: 'reunion',
  caliente: 'caliente',
  tibio: 'tibio',
  'no-acepto': 'no-acepto',
  perdido: 'perdido',
};

const NEXT_ACTION_BY_DESENLACE: Record<string, string> = {
  cliente: 'Publicar la página HOY, mandar accesos y confirmar la llamada de entrega de mañana.',
  reunion: 'Confirmar la cita/reunión por escrito y preparar la muestra antes.',
  caliente: 'Enviar el link de la página por WhatsApp en <5 min y escribir a la hora amarrada.',
  tibio: 'Seguimiento: acordar una hora exacta para mostrarle la página ya hecha.',
  'no-acepto': 'Dar de baja la demo el viernes y reactivar en 90 días con un caso de éxito del rubro.',
  perdido: 'Reactivar en 90 días — sin contacto antes.',
};

export function summarizeFromSurvey(s: CallSurveyAnswers, lead: Lead): CallSummary {
  const parts = [
    'Reporte manual del vendedor (sin transcripción).',
    s.resultado ? `Resultado: ${surveyLabel('resultado', s.resultado)}.` : '',
    s.objecion ? `Objeción principal: ${surveyLabel('objecion', s.objecion)}.` : 'Sin objeción registrada.',
    s.oferta === 'si' ? 'Presentó la oferta.' : 'No llegó a presentar la oferta.',
    s.hora === 'amarrada'
      ? 'Aceptó ver la página con hora amarrada.'
      : s.hora === 'sin-hora'
        ? 'Aceptó ver la página, pero sin hora.'
        : s.hora === 'no'
          ? 'No aceptó ver la página.'
          : '',
    s.desenlace ? `Desenlace: ${surveyLabel('desenlace', s.desenlace)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    summary: parts,
    temperature: DESENLACE_TO_TEMP[s.desenlace] ?? lead.temperature,
    nextAction: NEXT_ACTION_BY_DESENLACE[s.desenlace] ?? '',
  };
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

  // Tope duro de 90s: si el server cuelga (el edge ya tiene timeout propio,
  // esto es la red de seguridad del navegador), que el vendedor vea un error
  // claro en vez de "Preparando…" eterno. El abort del caller (supersede)
  // sigue teniendo prioridad: se combinan ambos señales.
  const timeoutSignal = AbortSignal.timeout(90000);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: requestSignal,
    });
  } catch (e) {
    // Timeout propio (no del caller): mensaje claro. El abort del caller se
    // re-lanza para que el flujo de supersede siga comportándose igual.
    if (e instanceof DOMException && e.name === 'AbortError' && !signal?.aborted) {
      throw new Error('El copilot tardó demasiado (90s) — reintenta.');
    }
    throw e;
  }

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
  // Flush final: si el último chunk de red cortó una secuencia UTF-8 a la
  // mitad (tildes y emojis son multibyte), esos bytes quedan retenidos en el
  // decoder — sin esto, el JSON del debrief llega truncado y no parsea.
  const tail = decoder.decode();
  if (tail) {
    full += tail;
    onDelta?.(tail);
  }
  return full;
}

// El playbook ya NO viaja desde el navegador: vive en el servidor (generado
// por npm run sync:playbook). Cada request baja de ~58KB a ~2-5KB de subida.
const supaBriefing = (lead: Lead, history: string, memory: string, apertura: 'A' | 'B', vendor: string, onDelta?: (t: string) => void, signal?: AbortSignal) =>
  callFn(
    { mode: 'briefing', lead: leadBrief(lead), history, memory, apertura, vendor, script: lead.script, settings: settingsForPrompt() },
    onDelta,
    signal
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
      vendor: args.vendor ?? '',
      script: args.script ?? '',
      settings: settingsForPrompt(),
    },
    onDelta,
    signal
  );

// Precalienta el cache del modelo de suggest (fire-and-forget). OpenRouter
// cachea el prefijo del system prompt automáticamente por modelo.
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
    vendor: args.vendor ?? '',
    script: args.script ?? '',
    settings: settingsForPrompt(),
  });
  try {
    const j = JSON.parse(raw) as CallDebrief;
    if (typeof j.coaching === 'string' && typeof j.lessons === 'string') {
      // Distinción que la UI usa: undefined = la función deployada aún no
      // genera el campo; '' = el coach decidió que es mejor NO escribir.
      return { ...j, whatsapp: typeof j.whatsapp === 'string' ? j.whatsapp : undefined };
    }
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
  const whatsapp = `Hola, le llamé hace un momento de ZerionStudio — disculpe si le agarré ocupado. Solo le dejo esto: tenemos una muestra de cómo quedaría la página de ${args.lead.company}, gratis y sin compromiso, para que la vea cuando tenga un minuto. Si no le interesa, no le vuelvo a escribir. Saludos 🙌`;
  return { coaching, lessons, whatsapp };
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

const CALL_COLS =
  'id, lead_id, transcript, summary, temperature, next_action, stats, coaching, created_at, outcome';

/** Fila de Supabase → registro tipado (una sola conversión para todas las queries). */
function rowToCall(r: Record<string, unknown>): CopilotCallRecord {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    transcript: (r.transcript as string) ?? '',
    summary: (r.summary as string) ?? '',
    temperature: (r.temperature as string) ?? '',
    nextAction: (r.next_action as string) ?? '',
    stats: (r.stats as string) ?? '',
    coaching: (r.coaching as string) ?? '',
    createdAt: r.created_at as string,
    outcome: (r.outcome as CallOutcome | null) ?? null,
  };
}

/** ¿El error es "la columna outcome no existe" (schema.sql sin re-correr)? */
const missingOutcomeCol = (e: { code?: string; message?: string } | null): boolean =>
  Boolean(e && (e.code === '42703' || /outcome/i.test(e.message ?? '')));

async function supaSaveCall(rec: NewCallRecord): Promise<void> {
  const { data: u } = await supabase!.auth.getUser();
  if (!u.user) return;
  const base = {
    lead_id: rec.leadId,
    user_id: u.user.id,
    transcript: rec.transcript,
    summary: rec.summary,
    temperature: rec.temperature,
    next_action: rec.nextAction,
    stats: rec.stats,
    coaching: rec.coaching,
  };
  const { error } = await supabase!.from('copilot_calls').insert({ ...base, outcome: rec.outcome });
  // La columna `outcome` es nueva: si la base todavía no la tiene, se guarda la
  // llamada SIN métricas antes que perderla. Perder el transcript y el coaching
  // por una columna de dashboard sería el peor intercambio posible.
  if (missingOutcomeCol(error)) {
    console.warn('[copilot] guardando sin `outcome`: re-corre supabase/schema.sql para activar las métricas.');
    await supabase!.from('copilot_calls').insert(base);
  }
}
async function supaListCalls(leadId: string): Promise<CopilotCallRecord[]> {
  const run = (cols: string) =>
    supabase!
      .from('copilot_calls')
      .select(cols)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10);
  let { data, error } = await run(CALL_COLS);
  // Base sin la columna nueva: se reintenta sin ella (el historial del lead no
  // depende de las métricas).
  if (missingOutcomeCol(error)) ({ data } = await run(CALL_COLS.replace(', outcome', '')));
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToCall);
}

/**
 * Las llamadas de los últimos N días para el dashboard de métricas.
 * RLS ya limita a las propias del usuario (o todas si es admin).
 * Sin transcript: el dashboard solo agrega números y traerlos sería mover
 * megas por gusto.
 */
async function supaListRecentCalls(days: number): Promise<CopilotCallRecord[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await supabase!
    .from('copilot_calls')
    .select('id, lead_id, summary, temperature, next_action, stats, coaching, created_at, outcome')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000);
  // Sin la columna, el dashboard no puede medir NADA: se dice con todas las
  // letras en vez de mostrar un embudo vacío que parezca "no vendiste".
  if (missingOutcomeCol(error)) {
    throw new Error(
      'Falta activar las métricas en la base: re-corre supabase/schema.sql (agrega la columna `outcome` a copilot_calls). Es idempotente, no borra nada.'
    );
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => rowToCall({ ...r, transcript: '' }));
}
// Un valor corrupto en localStorage no debe romper guardar/listar para siempre.
function readMockCalls(): CopilotCallRecord[] {
  try {
    const all = JSON.parse(localStorage.getItem(CALLS_KEY) ?? '[]');
    if (!Array.isArray(all)) return [];
    // Las llamadas guardadas antes del dashboard no traen outcome: se
    // normaliza a null para que el resto del código no vea undefined.
    return (all as CopilotCallRecord[]).map((c) => ({ ...c, outcome: c.outcome ?? null }));
  } catch {
    return [];
  }
}
async function mockSaveCall(rec: NewCallRecord): Promise<void> {
  const all = readMockCalls();
  // Transcript acotado: 50 llamadas sin tope reventarían la cuota (~5MB).
  all.unshift({
    ...rec,
    transcript: rec.transcript.slice(-6000),
    id: `call-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  try {
    localStorage.setItem(CALLS_KEY, JSON.stringify(all.slice(0, 50)));
  } catch {
    /* cuota llena: el mock no debe tumbar el guardado (paridad con supa) */
  }
}
async function mockListCalls(leadId: string): Promise<CopilotCallRecord[]> {
  return readMockCalls().filter((c) => c.leadId === leadId).slice(0, 10);
}
async function mockListRecentCalls(days: number): Promise<CopilotCallRecord[]> {
  const since = Date.now() - days * 86400_000;
  return readMockCalls().filter((c) => new Date(c.createdAt).getTime() >= since);
}
export const saveCopilotCall: (rec: NewCallRecord) => Promise<void> =
  supabase ? supaSaveCall : mockSaveCall;
export const listCopilotCalls: (leadId: string) => Promise<CopilotCallRecord[]> =
  supabase ? supaListCalls : mockListCalls;
/** Llamadas recientes para el dashboard de métricas (días hacia atrás). */
export const listRecentCopilotCalls: (days: number) => Promise<CopilotCallRecord[]> =
  supabase ? supaListRecentCalls : mockListRecentCalls;

// El resultado alimenta moveLead directo: una temperatura fuera del union (el
// proveedor Kimi va solo por prompt, sin schema) sacaría al lead de todas las
// columnas del Kanban. Se valida contra la lista real antes de devolver.
const VALID_TEMPS: readonly string[] = ['nuevo', 'frio', 'tibio', 'caliente', 'reunion', 'cliente', 'no-acepto', 'perdido'];

async function supaSummary(lead: Lead, transcript: string): Promise<CallSummary> {
  const raw = await callFn({
    mode: 'summary',
    lead: leadBrief(lead),
    playbook: '', // el resumen no necesita el playbook completo
    transcript,
  });
  try {
    const j = JSON.parse(raw) as CallSummary;
    if (j.summary && VALID_TEMPS.includes(j.temperature)) return j;
    if (j.summary) return { ...j, temperature: lead.temperature };
  } catch {
    /* cae al fallback */
  }
  return { summary: raw, temperature: lead.temperature, nextAction: '' };
}

// ===========================================================================
// Mock — playbook + streaming simulado (demo sin API)
// ===========================================================================
const streamOut = async (text: string, onDelta?: (t: string) => void, signal?: AbortSignal): Promise<string> => {
  if (!onDelta) return text;
  const words = text.split(' ');
  for (let i = 0; i < words.length; i += 3) {
    // Paridad con el fetch real: un stream abortado deja de emitir tokens.
    if (signal?.aborted) return text;
    onDelta(words.slice(i, i + 3).join(' ') + ' ');
    await new Promise((r) => setTimeout(r, 40));
  }
  return text;
};

async function mockBriefing(lead: Lead, history: string, _memory: string, apertura: 'A' | 'B', vendor: string, onDelta?: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const e = lead.enrichment;
  const noWeb = !lead.website.trim();
  const s = getCopilotSettings();
  const histLine = history.trim()
    ? [`**Ya tienes historia con este prospecto:** ${history.trim()}`, 'Retómala: no arranques de cero, referénciala ("La vez pasada quedamos en…").', '']
    : [];
  const settingsLine = s.pitch.trim() ? [`**Tu oferta (úsala tal cual):** ${s.pitch.trim()}`, ''] : [];
  // Prueba > promesa: si hay casos reales, el briefing deja UNO listo para la llamada.
  const proofLine = s.proof.trim()
    ? [`**Tu prueba (suéltala antes del precio, o en la primera objeción):** ${s.proof.trim().split('\n')[0]}`, '']
    : [];
  const semaforo = leadSemaforo(lead);
  // El encuadre de estatus SOLO con calificación alta (contrato de verdad: si el
  // rating es bajo o desconocido, no se dice). El cumplido, desde arriba.
  const ratingAlto = e?.rating != null && e.rating >= 4.5;
  const estatus = ratingAlto
    ? `estoy llamando solo a los mejor calificados de la zona — y con ${e!.rating} estrellas y ${e!.reviewCount} reseñas, ustedes están en esa lista`
    : 'antes de llamarle busqué su negocio en Google, como haría un cliente';
  const opener = aperturaGuionMock(apertura, { nombre: lead.contactName || 'Buenas', estatus, sinWeb: noWeb, vendor });
  const tono =
    apertura === 'A'
      ? '*(sinceridad total, sonrisa audible, postura asuntiva — el remate es dato + pregunta sobre SU negocio, jamás permiso)*'
      : '*(tono de conocido: saluda, PAUSA real hasta que responda, y recién ahí sigues — el remate es pregunta, no permiso)*';
  const text = [
    ...settingsLine,
    ...proofLine,
    ...histLine,
    `**Tu apertura ${apertura} (dila y CALLA):**`,
    opener,
    tono,
    '',
    `**${semaforo.verde ? 'Semáforo 🟢' : 'Semáforo 🟡'}:** ${semaforo.verde ? 'clientela visible — puedes prometer resultado y usar la garantía completa.' : 'poca clientela visible — promete SOLO ver-antes-de-pagar; nada de cifras de clientes.'}`,
    '',
    '**Meta:** que acepte VER su página ya hecha + la hora a la que la va a ver (link por WhatsApp).',
    '',
    '*Lo demás es turno por turno: cada frase siguiente te la soplo en vivo según lo que responda.*',
  ].join('\n');
  await new Promise((r) => setTimeout(r, 400));
  return streamOut(text, onDelta, signal);
}

async function mockSuggest(args: SuggestArgs, onDelta: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const card = args.trigger ? detectObjection(args.trigger) : detectObjection(args.transcript.slice(-300));
  let text: string;
  if (card) {
    text = `**Dile esto:** ${card.response}\n\n*(${card.why})*`;
  } else if (args.moment) {
    text = `**${args.moment.split(':')[0]}** — ${args.moment.split(':').slice(1).join(':').trim()}`;
  } else if (/cuanto (cuesta|vale|sale)|precio|que incluye|cuanto se demora/i.test(args.transcript.slice(-200))) {
    text =
      '🟢 **SEÑAL DE COMPRA** — deja de presentar y cierra: "[PRECIO], una sola vez. Pero véala primero — ya está hecha. ¿Se la mando? ¿A qué hora la alcanza a ver?"';
  } else {
    text =
      '**Siguiente pregunta:** "¿Hoy cómo les llega la gente nueva — puro boca a boca, o también por internet?" Escucha su respuesta y cuantifica: ¿cuántos clientes al mes? ¿cuánto deja cada uno? El que pregunta, controla.';
  }
  await new Promise((r) => setTimeout(r, 350));
  // Los textos del playbook traen [PRECIO]/[MENSUAL]: aquí no hay LLM que los
  // resuelva, así que se interpolan desde los Settings antes de mostrar.
  return streamOut(fillPrecios(text), onDelta, signal);
}

async function mockSummary(lead: Lead, transcript: string): Promise<CallSummary> {
  await new Promise((r) => setTimeout(r, 600));
  const t = transcript.toLowerCase();
  let temperature: Temperature = 'frio';
  let nextAction = 'Volver a llamar en 3 días con el dato del negocio.';
  // "ya LE pagué" (a nosotros) — el "le" es obligatorio: "ya pagué publicidad
  // en Facebook" es una queja de gasto pasado, no un pago confirmado.
  if (/transferencia (hecha|enviada|lista)|ya le (pague|deposite|transferi)|(mande|envie) (la transferencia|el comprobante|el deposito)|pago (confirmado|recibido)|recibido el pago/i.test(t)) {
    temperature = 'cliente';
    nextAction = 'Publicar la página HOY, mandar accesos y confirmar la llamada de entrega de mañana.';
  } else if (/(vi|revise|abri) la pagina.{0,40}(no|pero)|la pagina.{0,30}no (me convenc|la quiero|me interesa|me gusto)|no (la|lo) voy a (tomar|comprar|coger)|asi no mas dejemoslo|mejor no,? gracias/i.test(t)) {
    // Vio su página construida y dijo que no: demo muerta → reactivación.
    temperature = 'no-acepto';
    nextAction = 'Dar de baja la demo el viernes y reactivar en 90 días con caso de éxito del rubro.';
  } else if (/jueves|manana|lunes|martes|miercoles|viernes|agend|cita|reunion|demo/i.test(t)) {
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
  apertura: 'A' | 'B',
  vendor: string,
  onDelta?: (t: string) => void,
  signal?: AbortSignal
) => Promise<string> = supabase ? supaBriefing : mockBriefing;
export const copilotSuggest: (
  args: SuggestArgs,
  onDelta: (t: string) => void,
  signal?: AbortSignal
) => Promise<string> = supabase ? supaSuggest : mockSuggest;
export const copilotSummary: (lead: Lead, transcript: string) => Promise<CallSummary> =
  supabase ? supaSummary : mockSummary;
