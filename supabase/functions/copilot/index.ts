// ============================================================================
// Supabase Edge Function — copilot
// ----------------------------------------------------------------------------
// El coach de ventas en tiempo real. El navegador transcribe la llamada
// (Web Speech API) y llama aquí; esta función consulta a Claude con el
// playbook de ventas + la ficha del lead y devuelve la sugerencia en
// STREAMING (texto plano, token a token) para que aparezca en <2s.
//
//   body: { mode: 'briefing' | 'suggest' | 'summary',
//           lead: string, playbook: string, transcript?: string, trigger?: string }
//
//   briefing → plan de apertura pre-llamada            (stream de texto)
//   suggest  → sugerencia en vivo durante la llamada    (stream de texto)
//   summary  → resumen al colgar                        (JSON: summary/temperature/nextAction)
//
// La ANTHROPIC_API_KEY vive SOLO aquí (secret del servidor, nunca en el bundle).
//
// Deploy:  supabase functions deploy copilot
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PLAYBOOK } from './playbook.ts';
import { APERTURA_A_LLM_SPEC, APERTURA_B_LLM_SPEC } from './aperturaSpec.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// Sonnet 5 por defecto para briefing/resumen/coaching: calidad casi-Opus en
// análisis a <1/2 del precio ($3/$15 vs $5/$25) — la inteligencia profunda
// vive en el playbook, el modelo solo la aplica. Cambiable sin redeploy:
//   supabase secrets set COPILOT_MODEL=claude-opus-4-8   (volver a Opus)
const MODEL = Deno.env.get('COPILOT_MODEL') ?? 'claude-sonnet-5';
// Modelo SOLO para las sugerencias en vivo (lo más sensible a latencia).
// Default: Haiku 4.5 — TTFT ~0.9s vs ~2s de Opus y 5x más barato; el
// conocimiento vive en el playbook (15k tokens cacheados), así que la tarea
// en vivo es clasificar+seleccionar+reformular, justo donde el modelo chico
// rinde casi igual. Para volver a Opus en vivo:
//   supabase secrets set COPILOT_MODEL_SUGGEST=claude-opus-4-8
const MODEL_SUGGEST = Deno.env.get('COPILOT_MODEL_SUGGEST') ?? 'claude-haiku-4-5';

// Proveedor alterno OpenAI-compatible (Kimi/Moonshot u otro) para comparar
// costo/latencia sin tocar código:
//   supabase secrets set COPILOT_PROVIDER=kimi
//   supabase secrets set KIMI_API_KEY=sk-...
//   supabase secrets set KIMI_MODEL=<id real del modelo, p.ej. kimi-k3>
const PROVIDER = (Deno.env.get('COPILOT_PROVIDER') ?? 'anthropic').toLowerCase();
const KIMI_API_KEY = Deno.env.get('KIMI_API_KEY') ?? '';
const KIMI_BASE_URL = (Deno.env.get('KIMI_BASE_URL') ?? 'https://api.moonshot.ai/v1').replace(/\/+$/, '');
const KIMI_MODEL = Deno.env.get('KIMI_MODEL') ?? 'kimi-k3';

// Versión visible en las cabeceras de TODA respuesta (incluido el preflight):
//   curl -sI -X OPTIONS <url>/functions/v1/copilot | grep x-copilot-version
// Súbela en cada cambio relevante — es la forma de verificar qué está deployado.
const VERSION = '2026-07-23.2-nombre-vendedor';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'x-copilot-version': VERSION,
};

const PERSONA = `Eres "el Closer" de ZerionStudio. Vendes con UNA sola voz — directa, cálida, con certeza tranquila — siguiendo EL SISTEMA (la columna vertebral del playbook). Tu framework es LA LÍNEA RECTA (el mapa de toda la llamada) y todo pitch sigue EL PITCH DE CONTRASTE (dolor → contraste → retirada); lo demás son jugadas puntuales que el sistema invoca — JAMÁS cambias de personalidad a mitad de llamada y JAMÁS citas metodologías ni gurús. Le susurras al oído a un vendedor DURANTE una llamada en frío real. Él vende páginas web a negocios locales (ZerionStudio) con el modelo DEMO-FIRST: la página se construye ANTES de cobrar, el prospecto la ve terminada por WhatsApp, y solo si la quiere paga. Los montos NUNCA viven en el playbook: donde diga [PRECIO] o [MENSUAL], el monto real sale SIEMPRE de MIS PRECIOS (MI NEGOCIO) — al hablar se dice el monto, jamás el corchete, y jamás inventes uno. La venta del TOQUE 1 es que acepte VER su página + la hora a la que la va a ver; el dinero se cierra en el TOQUE 2, cuando ya la vio. El paso se pide directo y más de una vez, y en frío el vendedor LLEVA la llamada. Tu único trabajo: que esta llamada termine con su paso amarrado.

CÓMO PIENSAS (proceso interno — jamás lo expliques en la respuesta):
1. Detecta el MOMENTO de la llamada: gatekeeper, apertura, descubrimiento, pitch, objeción, precio, señal de compra, peligro de colgar, cierre. El cliente puede mandarte su detección: confírmala o corrígela leyendo la transcripción.
2. Juega LA jugada de ESE momento según el playbook: objeción → acordar + loop hacia "véala primero" (máx 2, nunca contradecir; si MI NEGOCIO trae CASOS REALES, injerta la anécdota de una frase del rubro más parecido); señal de compra → en T1 link + hora YA, en T2 cobrar YA; peligro → rescate de 15 segundos con un dato SUYO; descubrimiento → la siguiente pregunta que cuantifica el dolor (y el porqué del AHORA); precio → de frente (el monto de MIS PRECIOS, una vez) y de vuelta a la página, el monto jamás baja (en loop 2 primero el bono de acción, y el 50/50 de última carta); gatekeeper → aliado, y si la página existe, la jugada pre-built ("necesito mostrársela antes de darla de baja").
3. VERIFICA LOS GATES antes de subir de etapa: sin problema admitido (o resumen confirmado con "¿así es?") NO soplas el pitch — soplas el sello del problema; sin dolor re-articulado con SUS números NO soplas el precio — soplas el replay del dolor; y una llamada nunca termina sin próximo paso amarrado (hora de lectura, fecha o llamada de entrega).
4. Personaliza SIEMPRE con la ficha y el historial del prospecto, y con la oferta real del vendedor (MI NEGOCIO tiene prioridad sobre el playbook).

CONTRATO DE VERDAD (anti-alucinación — esto es INVIOLABLE):
- Datos del PROSPECTO: usa SOLO lo que está en la FICHA o lo que él dijo en la transcripción. Si no sabes su rating, reseñas, nombre o rubro exacto — NO lo inventes: usa la versión sin dato ("vi su negocio en Google" en vez de "sus 4.8 estrellas").
- Precios, plazos, garantías y formas de pago: usa SOLO los de MI NEGOCIO. Si MI NEGOCIO no los define, usa los del playbook marcados como ejemplo o difiere ("eso lo vemos con la muestra en la mano") — JAMÁS inventes una cifra, una garantía o una promesa que Martín no pueda cumplir.
- Casos de éxito y clientes: NUNCA inventes nombres de clientes, negocios ni resultados ("le hicimos la página a X y ganó Y"). Las anécdotas salen SOLO de los CASOS REALES de MI NEGOCIO o del historial; si no hay ninguno, ofrece la muestra gratis como prueba (la página ya hecha ES la prueba).
- Transcripción ambigua o con ruido: prefiere una PREGUNTA sobre una afirmación. Ante la duda de qué dijo, la jugada segura es un espejo o una calibrada.
- Números del prospecto (ticket, clientes perdidos): si él ya los dijo, repítelos EXACTOS; no los redondees hacia arriba ni "mejores" su matemática.

CÓMO RESPONDES:
- SOLO lo accionable: la frase EXACTA para decir en voz alta AHORA, en **negrita**, lista para salir de la boca. Opcional: UNA nota en cursiva (tonalidad o porqué) de una línea.
- Máximo 2-4 frases. El vendedor lee de reojo EN la llamada.
- Español latino natural y HABLADO (como suena la gente, no como se escribe). Con la energía del momento: certeza tranquila, entusiasmo o urgencia según toque.
- Nada de teoría, nada de "deberías considerar", nada de meta-comentarios, JAMÁS nombres de metodologías o autores.
- La transcripción viene del altavoz del teléfono: ambas voces mezcladas, con errores. Interprétala con ese ruido, sin comentarlo.
- Suenas como quien ya hizo diez mil de estas llamadas y sabe exactamente qué sigue.`;

interface CopilotBody {
  mode?: string;
  lead?: string;
  playbook?: string;
  transcript?: string;
  trigger?: string;
  history?: string;
  settings?: string;
  /** Momento de la llamada detectado en el cliente ("label: mejor jugada"). */
  moment?: string;
  /** Estado estructurado: loops por objeción + números del prospecto. */
  callState?: string;
  /** Memoria del nicho: lecciones acumuladas de llamadas anteriores. */
  memory?: string;
  /** Stats de la llamada (para el debrief). */
  stats?: string;
  /** Variante de apertura de esta llamada (prueba A/B): 'A' honestidad radical | 'B' maestra. */
  apertura?: string;
  /** Nombre de pila del vendedor logueado — override a "Martín" del playbook. */
  vendor?: string;
}

// --- Llamada a Anthropic (raw HTTP; streaming SSE → texto plano) ------------
interface AnthropicRequest {
  model: string;
  max_tokens: number;
  stream?: boolean;
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Array<{ role: 'user'; content: string }>;
  output_config?: Record<string, unknown>;
  thinking?: Record<string, unknown>;
}

// `output_config.effort` solo existe en Opus 4.5+ / Sonnet 4.6+ / Fable.
// En Haiku 4.5 y Sonnet 4.5 el parámetro devuelve 400 — se omite.
const supportsEffort = (model: string): boolean => !/haiku|sonnet-4-5/.test(model);
const effortFor = (model: string): Record<string, unknown> =>
  supportsEffort(model) ? { output_config: { effort: 'low' } } : {};

// Sonnet 5 corre thinking ADAPTATIVO por defecto si no se manda el parámetro
// (Opus 4.8 y Haiku no) — eso sumaría latencia + tokens de razonamiento que
// este caso no necesita (el conocimiento vive en el playbook). Se desactiva.
const thinkingFor = (model: string): Record<string, unknown> =>
  /sonnet-5/.test(model) ? { thinking: { type: 'disabled' } } : {};

// Un solo reintento ante rate-limit/sobrecarga transitoria: en el suggest en
// vivo, 400ms extra le ganan por goleada a dejar al vendedor sin jugada.
const RETRYABLE = new Set([429, 500, 502, 503, 529]);

async function anthropicFetch(req: AnthropicRequest): Promise<Response> {
  const call = () =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(req),
    });
  let res = await call();
  if (RETRYABLE.has(res.status)) {
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 400));
    res = await call();
  }
  return res;
}

/** Convierte el SSE de Anthropic en un stream de texto plano (solo text_delta).
 * Si Anthropic emite un evento `error` DESPUÉS del 200 (p.ej. overloaded a
 * mitad de stream), se marca visible: media frase sin señal parece completa. */
function sseToTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const handleLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const evt = JSON.parse(payload) as {
        type?: string;
        delta?: { type?: string; text?: string };
        error?: { type?: string };
      };
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
        controller.enqueue(encoder.encode(evt.delta.text));
      } else if (evt.type === 'error') {
        controller.enqueue(encoder.encode(`\n⚠️ (respuesta cortada: ${evt.error?.type ?? 'error'} — toca Ayuda para reintentar)`));
      }
    } catch {
      /* línea SSE parcial/no-JSON: ignorar */
    }
  };

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) handleLine(line, controller);
      },
      flush(controller) {
        // Último trozo sin \n final (upstream cortado a media línea).
        if (buffer) handleLine(buffer, controller);
      },
    })
  );
}

// --- Proveedor OpenAI-compatible (Kimi/Moonshot u otro) ---------------------
interface OpenAIRequest {
  model: string;
  max_tokens: number;
  stream?: boolean;
  system: string;
  user: string;
  json?: boolean;
}

async function openaiFetch(req: OpenAIRequest): Promise<Response> {
  const call = () =>
    fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KIMI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.max_tokens,
        stream: req.stream ?? false,
        temperature: 0.6,
        ...(req.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      }),
    });
  let res = await call();
  if (RETRYABLE.has(res.status)) {
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 400));
    res = await call();
  }
  return res;
}

/** Convierte el SSE OpenAI-compatible en un stream de texto plano. */
function oaiSseToTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const handleLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const evt = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
        error?: { message?: string };
      };
      const text = evt.choices?.[0]?.delta?.content;
      if (text) controller.enqueue(encoder.encode(text));
      else if (evt.error) controller.enqueue(encoder.encode('\n⚠️ (respuesta cortada — toca Ayuda para reintentar)'));
    } catch {
      /* línea parcial: ignorar */
    }
  };

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) handleLine(line, controller);
      },
      flush(controller) {
        if (buffer) handleLine(buffer, controller);
      },
    })
  );
}

/** El system multi-bloque de Anthropic como texto único (para OpenAI-compat). */
function systemToText(blocks: Array<{ text: string }>): string {
  return blocks.map((b) => b.text).join('\n\n');
}

// Caching en dos bloques: el bloque estático (persona + playbook, idéntico en
// TODAS las llamadas de todos los leads) lleva cache_control y se paga una vez
// (~0.1x el input después del primer hit, y menos latencia). El bloque dinámico
// (mi negocio + ficha + historial, cambia por lead) va aparte, sin cache.
// Prefijo mínimo cacheable en Opus 4.8: ~4096 tokens — el playbook expandido
// lo supera con holgura.
function buildSystem(lead: string, playbook: string, history: string, settings: string, memory: string, vendor: string) {
  // El playbook y los ejemplos dicen "Martín" (el fundador). Quien hace ESTA
  // llamada puede ser otro vendedor del equipo: su nombre override a "Martín".
  const who = vendor.trim()
    ? `# TÚ, EL VENDEDOR (quien hace ESTA llamada)\nTe llamas ${vendor.trim()}. Preséntate SIEMPRE con tu nombre de pila. Donde el playbook, la persona o los ejemplos digan "Martín", di "${vendor.trim()}" en su lugar — jamás te presentes como Martín si ese no es tu nombre.\n\n`
    : '';
  const mine = settings.trim()
    ? `# MI NEGOCIO Y MI FORMA DE VENDER (PRIORIDAD: usa ESTO por encima del playbook — mis precios, mi oferta, mi tono)\n${settings.trim()}\n\n`
    : '';
  const hist = history.trim()
    ? `\n\n# HISTORIAL CON ESTE PROSPECTO (ya lo conoces — NO arranques de cero, referencia lo previo)\n${history.trim()}`
    : '';
  const mem = memory.trim()
    ? `\n\n# MEMORIA DEL NICHO (lecciones REALES de mis llamadas anteriores — pesan más que la teoría del playbook)\n${memory.trim()}`
    : '';
  return [
    {
      type: 'text' as const,
      text: `${PERSONA}\n\n# PLAYBOOK DE VENTAS (tu conocimiento de closer — aplícalo, no lo cites)\n${playbook}`,
      cache_control: { type: 'ephemeral' as const },
    },
    {
      type: 'text' as const,
      text: `${who}${mine}# FICHA DEL PROSPECTO (úsala: personaliza con SUS datos)\n${lead}${hist}${mem}`,
    },
  ];
}

// Toda excepción no manejada (red caída hacia Anthropic, body malformado…)
// debe salir como JSON CON CORS: el 500 pelado de Deno.serve no lleva CORS y
// el navegador lo disfraza de "blocked by CORS policy" — indescifrable.
Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    return json({ error: 'Error interno del copilot', detail: String(e).slice(0, 200) }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Auth: usuario del CRM activo (mismo patrón que find-leads).
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await asCaller.auth.getUser();
  if (!auth?.user) return json({ error: 'No autenticado — vuelve a iniciar sesión' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: caller, error: dbErr } = await admin
    .from('profiles')
    .select('id, active')
    .eq('id', auth.user.id)
    .maybeSingle();
  // Un blip de la DB no es lo mismo que una cuenta inactiva: 503 ≠ 403.
  if (dbErr) return json({ error: 'No se pudo verificar la cuenta — reintenta' }, 503);
  if (!caller || caller.active === false) return json({ error: 'Cuenta inactiva' }, 403);

  if (PROVIDER === 'kimi') {
    if (!KIMI_API_KEY) return json({ error: 'KIMI_API_KEY no configurada (COPILOT_PROVIDER=kimi requiere supabase secrets set KIMI_API_KEY=...)' }, 500);
  } else if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY no configurada (supabase secrets set ANTHROPIC_API_KEY=...)' }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as CopilotBody;
  // Coerción defensiva: un body con {"lead": 123} no debe tumbar la función
  // (los números no tienen .slice y el TypeError saldría como 500 sin CORS).
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const mode = typeof body.mode === 'string' ? body.mode : 'suggest';
  const lead = str(body.lead).slice(0, 4000);
  // El playbook vive SOLO aquí (generado por npm run sync:playbook). No se
  // acepta override del cliente: un playbook único por request rompería el
  // cache (cada uno sería un cache-write de ~23k tokens a 1.25x) y dejaría
  // usar la key de Anthropic con contenido arbitrario.
  const playbook = PLAYBOOK;
  const transcript = str(body.transcript).slice(-6000);
  const trigger = str(body.trigger).slice(0, 500);
  // 6000: los ajustes ahora incluyen MIS CASOS REALES (la munición de anécdotas)
  const settings = str(body.settings).slice(0, 6000);
  const history = str(body.history).slice(0, 4000);
  const moment = str(body.moment).slice(0, 600);
  const callState = str(body.callState).slice(0, 600);
  const memory = str(body.memory).slice(0, 5000);
  const stats = str(body.stats).slice(0, 800);
  const apertura = str(body.apertura) === 'B' ? 'B' : 'A';
  // El nombre del vendedor logueado (nombre de pila) — override a "Martín".
  const vendor = str(body.vendor).slice(0, 60);

  // -------------------------------------------------------------------- warm
  // Precalienta el cache del system (PERSONA + playbook, por modelo) para que
  // la PRIMERA sugerencia en vivo no pague el cache-write (~3-5s → ~1.2s).
  // El cache de Anthropic es por modelo: el briefing (Opus) NO calienta el de
  // Haiku, por eso el cliente dispara esto en paralelo (fire-and-forget).
  // Solo importa el bloque estático: los datos dinámicos van vacíos.
  if (mode === 'warm') {
    if (PROVIDER === 'kimi') return json({ ok: true }); // Moonshot cachea automático
    const res = await anthropicFetch({
      model: MODEL_SUGGEST,
      max_tokens: 1,
      ...thinkingFor(MODEL_SUGGEST),
      system: buildSystem('', playbook, '', '', '', vendor),
      messages: [{ role: 'user', content: 'ok' }],
    });
    return json({ ok: res.ok });
  }

  // ---------------------------------------------------------------- briefing
  if (mode === 'briefing') {
    const sys = buildSystem(lead, playbook, history, settings, memory, vendor);
    // SOLO la apertura: la llamada es turno por turno y cada frase siguiente
    // la sopla el coach EN VIVO según lo que el prospecto responda de verdad.
    // Prueba A/B de aperturas: el cliente alterna la variante por llamada y
    // queda registrada en las stats — la data decide cuál convierte más.
    const aperturaSpec = apertura === 'A' ? APERTURA_A_LLM_SPEC : APERTURA_B_LLM_SPEC;
    const userMsg =
      `Dame SOLO el arranque de la llamada. Esta llamada usa ${aperturaSpec}. Decible en 10-12 segundos.\n\nFormato EXACTO:\n\n**Tu apertura ${apertura} (dila y CALLA):**\nLA frase exacta entre comillas.\nUna nota de tonalidad en cursiva, de una sola línea.\n\n**Tu prueba (SOLO si MI NEGOCIO trae CASOS REALES — si no, omite esta sección entera):** el caso del rubro más parecido en UNA frase con su número, listo para soltarlo antes del precio o en la primera objeción.\n\n**Meta:** una línea — el objetivo del toque 1: que acepte VER su página ya hecha + la hora a la que la va a ver.\n\nNADA MÁS. Ni pasos siguientes, ni objeciones, ni el resto del guion: cada frase siguiente me la soplas EN VIVO según lo que el prospecto responda.`;

    if (PROVIDER === 'kimi') {
      const upstream = await openaiFetch({
        model: KIMI_MODEL, max_tokens: 380, stream: true, system: systemToText(sys), user: userMsg,
      });
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => '');
        return json({ error: `Kimi respondió ${upstream.status}`, detail: detail.slice(0, 300) }, 502);
      }
      return new Response(oaiSseToTextStream(upstream.body), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
      });
    }

    const upstream = await anthropicFetch({
      model: MODEL,
      max_tokens: 380,
      stream: true,
      system: sys,
      ...effortFor(MODEL),
      ...thinkingFor(MODEL),
      messages: [{ role: 'user', content: userMsg }],
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return json({ error: `Claude respondió ${upstream.status}`, detail: detail.slice(0, 300) }, 502);
    }
    return new Response(sseToTextStream(upstream.body), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
    });
  }

  // ----------------------------------------------------------------- suggest
  if (mode === 'suggest') {
    const ask = trigger
      ? `Se detectó: "${trigger}". Dame la respuesta EXACTA para decir ahora.`
      : 'Dame la mejor jugada AHORA (responder objeción, cerrar, o la siguiente pregunta).';
    const momentLine = moment
      ? `MOMENTO DETECTADO (confírmalo o corrígelo con la transcripción): ${moment}\n\n`
      : '';
    const stateLine = callState
      ? `ESTADO DE LA LLAMADA (lo llevó el detector local — respeta el número de loop y usa los números del prospecto EXACTOS): ${callState}\n\n`
      : '';
    // "Frase primero": con streaming, el vendedor tiene la frase decible en
    // TTFT+~200ms y el porqué llega mientras ya la está usando.
    const userMsg = `${momentLine}${stateLine}TRANSCRIPCIÓN RECIENTE DE LA LLAMADA (mic en altavoz, ambas voces mezcladas):\n"""\n${transcript || '(la llamada acaba de empezar)'}\n"""\n\n${ask}\n\nFORMATO OBLIGATORIO: línea 1 = SOLO la frase exacta para decir en voz alta (máx 15 palabras), en **negrita**. Línea 2 (opcional) = una sola oración en cursiva con la tonalidad o el porqué.`;
    const sys = buildSystem(lead, playbook, history, settings, memory, vendor);

    if (PROVIDER === 'kimi') {
      const upstream = await openaiFetch({
        model: KIMI_MODEL, max_tokens: 150, stream: true, system: systemToText(sys), user: userMsg,
      });
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => '');
        return json({ error: `Kimi respondió ${upstream.status}`, detail: detail.slice(0, 300) }, 502);
      }
      return new Response(oaiSseToTextStream(upstream.body), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
      });
    }

    const upstream = await anthropicFetch({
      model: MODEL_SUGGEST,
      max_tokens: 150,
      stream: true,
      system: sys,
      ...effortFor(MODEL_SUGGEST),
      ...thinkingFor(MODEL_SUGGEST),
      messages: [{ role: 'user', content: userMsg }],
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return json({ error: `Claude respondió ${upstream.status}`, detail: detail.slice(0, 300) }, 502);
    }
    return new Response(sseToTextStream(upstream.body), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
    });
  }

  // ----------------------------------------------------------------- debrief
  // El sales manager revisa la grabación: coaching accionable de ESTA llamada
  // + la MEMORIA DEL NICHO actualizada (lecciones generalizables que se
  // inyectan en todas las llamadas siguientes — así "aprende" el copilot).
  if (mode === 'debrief') {
    const debriefSystem =
      'Eres el mejor sales manager de Latinoamérica revisando la grabación de una llamada en frío de tu vendedor (vende páginas web + automatizaciones a negocios locales, Ecuador). Tu casa vende con LA LÍNEA RECTA (apertura → pitch → loops → cierre repetido) y el PITCH DE CONTRASTE (dolor → contraste → retirada); evalúa contra ese estándar y habla como jefe de ventas, no como libro. La transcripción viene del altavoz del teléfono: ambas voces mezcladas, con errores — interprétala con ese ruido.';
    const vendorLine = vendor.trim()
      ? `EL VENDEDOR SE LLAMA: ${vendor.trim()} — el mensaje de WhatsApp debe firmarse con SU nombre, jamás "Martín".\n\n`
      : '';
    const debriefUser = `${vendorLine}FICHA DEL PROSPECTO:\n${lead}\n\nSTATS DE LA LLAMADA:\n${stats || '(sin stats)'}\n\nMEMORIA DEL NICHO ACTUAL (lecciones acumuladas hasta hoy):\n"""\n${memory || '(vacía — primera llamada)'}\n"""\n\nTRANSCRIPCIÓN COMPLETA:\n"""\n${transcript || '(sin transcripción)'}\n"""\n\nDevuelve el JSON con coaching, lessons y whatsapp.`;

    if (PROVIDER === 'kimi') {
      const res = await openaiFetch({
        model: KIMI_MODEL,
        max_tokens: 1500,
        json: true,
        system:
          debriefSystem +
          ' Devuelve SOLO un objeto JSON con: "coaching" (string: 3-5 puntos concretos de esta llamada), "lessons" (string: la memoria del nicho ACTUALIZADA completa, máx 3500 caracteres) y "whatsapp" (string: mensaje de seguimiento listo para enviar — rescate takeaway con muestra gratis y salida fácil si no hubo cita pero es rescatable, confirmación de cita si la hubo, o "" si fue hostil o rechazó la oferta completa).',
        user: debriefUser,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return json({ error: `Kimi respondió ${res.status}`, detail: detail.slice(0, 300) }, 502);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return new Response(data.choices?.[0]?.message?.content ?? '{}', {
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const res = await anthropicFetch({
      model: MODEL,
      max_tokens: 1500,
      ...thinkingFor(MODEL),
      system: [{ type: 'text', text: debriefSystem }],
      output_config: {
        ...(supportsEffort(MODEL) ? { effort: 'low' } : {}),
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              coaching: {
                type: 'string',
                description:
                  'Coaching de ESTA llamada, 3-5 puntos concretos en bullets ("• "): (1) qué hizo BIEN el vendedor (uno solo, real), (2) el momento exacto que se perdió o la jugada que faltó, con la FRASE que debió decir, (3) qué hacer distinto en la próxima llamada. Directo, específico, cero teoría.',
              },
              lessons: {
                type: 'string',
                description:
                  'La MEMORIA DEL NICHO actualizada COMPLETA (no solo lo nuevo): fusiona lo aprendido en esta llamada con la memoria actual, elimina lo repetido u obsoleto, agrupa por temas (## Objeciones frecuentes y qué funciona / ## Aperturas / ## Horarios y rubros / ## Errores a evitar). SOLO lecciones GENERALIZABLES del nicho — los detalles de este prospecto específico van al historial del lead, no aquí. Máximo 3500 caracteres. Si la llamada no dejó nada nuevo generalizable, devuelve la memoria actual tal cual.',
              },
              whatsapp: {
                type: 'string',
                description:
                  'El mensaje de WhatsApp de seguimiento, listo para enviar tal cual (o "" si no corresponde). Reglas según el desenlace: (A) RESCATE — si NO quedó cita y el prospecto es rescatable (colgó rápido, "no me interesa" ANTES de escuchar la oferta, "mándeme info", quedó tibio): mensaje takeaway de máximo 400 caracteres — quién soy en una frase ("le llamé hace un momento de ZerionStudio"), el regalo sin compromiso (una muestra de cómo quedaría la página de SU negocio, gratis, la ve cuando tenga un minuto), y la salida fácil textual ("si no le interesa, no le vuelvo a escribir — sin compromiso"). CERO preguntas de venta, CERO precio, máximo 1 emoji. Usa el nombre real del negocio y trato de usted. (B) CITA CERRADA — confirmación en 2 frases: recap de día/hora + "cuando le llegue este mensaje, ¿me confirma con un OK?". (C) NO ESCRIBIR — si el prospecto fue hostil, pidió que no lo contacten más, o dijo que no DESPUÉS de escuchar la oferta completa: devuelve "" (insistir por WhatsApp ahí quema el prospecto de dentro de 3 meses).',
              },
            },
            required: ['coaching', 'lessons', 'whatsapp'],
          },
        },
      },
      messages: [{ role: 'user', content: debriefUser }],
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `Claude respondió ${res.status}`, detail: detail.slice(0, 300) }, 502);
    }
    const data = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };
    if (data.stop_reason === 'refusal') {
      return json({ error: 'El modelo declinó analizar esta llamada.' }, 502);
    }
    const text = (data.content ?? []).find((b) => b.type === 'text')?.text ?? '{}';
    return new Response(text, { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // ----------------------------------------------------------------- summary
  // Definiciones de ÉXITO por toque (modelo demo-first): sin esto el modelo
  // clasifica a ciegas y el close rate que se calcule encima es basura.
  const SUMMARY_RUBRIC =
    'El vendedor usa un modelo demo-first en DOS toques: en el TOQUE 1 el éxito es que el prospecto acepte VER su página ya hecha Y dé la hora a la que la va a ver (eso es una llamada GANADA del T1 → temperature "caliente", nextAction = mandar el link por WhatsApp en <5 min y escribir a la hora dicha). En el TOQUE 2 el éxito es el PAGO: si el pago quedó confirmado o el prospecto aceptó pagar → temperature "cliente" (venta cerrada). Cita explícita para verla juntos o reunión presencial → "reunion". Aceptó ver la página pero SIN hora amarrada → "tibio" (la hora es el test de compromiso). YA VIO su página construida y aun así dijo que NO la quiere → "no-acepto" (distinto de perdido: el activo existe y entra a reactivación en 90 días; nextAction = dar de baja la demo el viernes y reactivar en 90 días con caso de éxito del rubro). Rechazo definitivo SIN haber visto la página, u hostilidad → "perdido".';
  if (mode === 'summary') {
    if (PROVIDER === 'kimi') {
      const res = await openaiFetch({
        model: KIMI_MODEL,
        max_tokens: 700,
        json: true,
        system:
          `Eres un analista de ventas. Resumes llamadas de prospección en frío para un CRM, en español, con criterio comercial. ${SUMMARY_RUBRIC} Devuelve SOLO un objeto JSON con exactamente estas claves: "summary" (string, 3-5 frases), "temperature" (uno de: nuevo, frio, tibio, caliente, reunion, cliente, no-acepto, perdido) y "nextAction" (string, la próxima acción concreta con cuándo).`,
        user: `FICHA DEL PROSPECTO:\n${lead}\n\nTRANSCRIPCIÓN COMPLETA DE LA LLAMADA:\n"""\n${transcript || '(sin transcripción)'}\n"""\n\nAnaliza la llamada y devuelve el JSON.`,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return json({ error: `Kimi respondió ${res.status}`, detail: detail.slice(0, 300) }, 502);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content ?? '{}';
      return new Response(text, { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const res = await anthropicFetch({
      model: MODEL,
      max_tokens: 700,
      ...thinkingFor(MODEL),
      system: [
        {
          type: 'text',
          text: `Eres un analista de ventas. Resumes llamadas de prospección en frío para un CRM, en español, con criterio comercial. ${SUMMARY_RUBRIC}`,
        },
      ],
      output_config: {
        ...(supportsEffort(MODEL) ? { effort: 'low' } : {}),
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: {
                type: 'string',
                description:
                  'Resumen de la llamada en 3-5 frases: qué se habló, objeciones que surgieron, interés real detectado.',
              },
              temperature: {
                type: 'string',
                enum: ['nuevo', 'frio', 'tibio', 'caliente', 'reunion', 'cliente', 'no-acepto', 'perdido'],
                description:
                  'Etapa sugerida según el interés real mostrado. "cliente" SOLO con pago confirmado o aceptación explícita de pagar (T2 ganado); "caliente" = aceptó ver la página con hora amarrada (T1 ganado); "no-acepto" = YA VIO su página construida y dijo que no la quiere (reactivable — distinto de perdido).',
              },
              nextAction: {
                type: 'string',
                description: 'La próxima acción concreta, con cuándo (ej. "llamar el jueves 10am con el diseño de muestra").',
              },
            },
            required: ['summary', 'temperature', 'nextAction'],
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: `FICHA DEL PROSPECTO:\n${lead}\n\nTRANSCRIPCIÓN COMPLETA DE LA LLAMADA (mic en altavoz, ambas voces mezcladas, con ruido de transcripción):\n"""\n${transcript || '(sin transcripción)'}\n"""\n\nAnaliza la llamada y devuelve el JSON.`,
        },
      ],
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `Claude respondió ${res.status}`, detail: detail.slice(0, 300) }, 502);
    }
    const data = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };
    if (data.stop_reason === 'refusal') {
      return json({ error: 'El modelo declinó analizar esta llamada.' }, 502);
    }
    const text = (data.content ?? []).find((b) => b.type === 'text')?.text ?? '{}';
    return new Response(text, { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return json({ error: `Modo desconocido: ${mode}` }, 400);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
