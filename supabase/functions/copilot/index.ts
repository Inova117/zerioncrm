// ============================================================================
// Supabase Edge Function — copilot
// ----------------------------------------------------------------------------
// El coach de ventas en tiempo real. El navegador transcribe la llamada
// (Deepgram / Web Speech API) y llama aquí; esta función consulta a DeepSeek
// vía OpenRouter con el playbook de ventas + la ficha del lead y devuelve la
// sugerencia en STREAMING (texto plano, token a token) para que aparezca en <2s.
//
//   body: { mode: 'briefing' | 'suggest' | 'summary',
//           lead: string, playbook: string, transcript?: string, trigger?: string }
//
//   briefing → plan de apertura pre-llamada            (stream de texto)
//   suggest  → sugerencia en vivo durante la llamada    (stream de texto)
//   summary  → resumen al colgar                        (JSON: summary/temperature/nextAction)
//   debrief  → coaching post-llamada + memoria del nicho (JSON: coaching/lessons/whatsapp)
//   warm     → precalienta el cache del proveedor       (fire-and-forget)
//
// La OPENROUTER_API_KEY vive SOLO aquí (secret del servidor, nunca en el bundle).
// OpenRouter usa el formato OpenAI-compatible (/chat/completions, SSE).
//
// Deploy:  supabase functions deploy copilot
// Secret:  supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PLAYBOOK } from './playbook.ts';
import { APERTURA_A_LLM_SPEC, APERTURA_B_LLM_SPEC } from './aperturaSpec.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';

const OPENROUTER_BASE_URL = (Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

// Modelo DeepSeek por defecto para briefing/resumen/debrief/coaching:
// deepseek-v4-flash-0731 es DeepSeek V4 Flash (lanzado 31 jul / 1 ago 2026),
// la versión más nueva del modelo Flash en el catálogo público de OpenRouter.
// (El alias "-latest" de OpenRouter NO es un ID válido para la key del usuario.)
// Override sin redeploy:
//   supabase secrets set COPILOT_MODEL=deepseek/deepseek-v4-pro
const MODEL = Deno.env.get('COPILOT_MODEL') ?? 'deepseek/deepseek-v4-flash-0731';
// Modelo para las sugerencias EN VIVO (lo más sensible a latencia): misma
// V4 Flash 0731; OpenRouter hace cache de contexto por modelo.
const MODEL_SUGGEST = Deno.env.get('COPILOT_MODEL_SUGGEST') ?? 'deepseek/deepseek-v4-flash-0731';

// Proveedor alterno OpenAI-compatible (A/B testing, ej. Kimi K3 de Moonshot):
//   supabase secrets set COPILOT_PROVIDER=kimi
//   supabase secrets set KIMI_API_KEY=sk-...
//   supabase secrets set KIMI_MODEL=<id real del modelo, p.ej. kimi-k3>
const PROVIDER = (Deno.env.get('COPILOT_PROVIDER') ?? 'openrouter').toLowerCase();
const KIMI_API_KEY = Deno.env.get('KIMI_API_KEY') ?? '';
const KIMI_BASE_URL = (Deno.env.get('KIMI_BASE_URL') ?? 'https://api.moonshot.ai/v1').replace(/\/+$/, '');
const KIMI_MODEL = Deno.env.get('KIMI_MODEL') ?? 'kimi-k3';

// Versión visible en las cabeceras de TODA respuesta (incluido el preflight):
//   curl -sI -X OPTIONS <url>/functions/v1/copilot | grep x-copilot-version
// Súbela en cada cambio relevante — es la forma de verificar qué está deployado.
const VERSION = '2026-08-03.1-guion-cliente';

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
  /** Guion específico de ESTE prospecto (lead.script). Prioridad máxima: se
   *  sigue palabra por palabra por encima de las jugadas del playbook. */
  script?: string;
}

// ---------------------------------------------------------------------------
// Proveedor OpenAI-compatible (OpenRouter default, Kimi alterno)
// ---------------------------------------------------------------------------
interface OpenAIRequest {
  model: string;
  max_tokens: number;
  stream?: boolean;
  system: string;
  user: string;
  json?: boolean;
}

/** Un solo reintento ante rate-limit/sobrecarga transitoria: en el suggest en
 *  vivo, 400ms extra le ganan por goleada a dejar al vendedor sin jugada. */
const RETRYABLE = new Set([429, 500, 502, 503, 529]);

// OpenRouter: Autorización con la key del usuario (formato OpenAI).
async function openrouterFetch(req: OpenAIRequest): Promise<Response> {
  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY no configurada (supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...)' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
  const call = () =>
    fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
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

async function kimiFetch(req: OpenAIRequest): Promise<Response> {
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

/** Selecciona el fetch/llamada correcta según COPILOT_PROVIDER. */
function llmFetch(req: OpenAIRequest): Promise<Response> {
  return PROVIDER === 'kimi' ? kimiFetch(req) : openrouterFetch(req);
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

/** El system multi-bloque como texto único (formato OpenAI-compatible). */
function systemToText(blocks: Array<{ text: string }>): string {
  return blocks.map((b) => b.text).join('\n\n');
}

// Caching: OpenRouter / OpenAI-compat cachea el contexto automáticamente
// (los sistemas que reciben el mismo prefijo de tokens pagan menos). El
// playbook estático va PRIMERO en el system para maximizar el hit de cache;
// los datos dinámicos (ficha, historial, memoria) van después.
function buildSystem(lead: string, playbook: string, history: string, settings: string, memory: string, vendor: string, script: string) {
  // El playbook y los ejemplos dicen "Martín" (el fundador). Quien hace ESTA
  // llamada puede ser otro vendedor del equipo: su nombre override a "Martín".
  const who = vendor.trim()
    ? `# TÚ, EL VENDEDOR (quien hace ESTA llamada)\nTe llamas ${vendor.trim()}. Preséntate SIEMPRE con tu nombre de pila. Donde el playbook, la persona o los ejemplos digan "Martín", di "${vendor.trim()}" en su lugar — jamás te presentes como Martín si ese no es tu nombre.\n\n`
    : '';
  const mine = settings.trim()
    ? `# MI NEGOCIO Y MI FORMA DE VENDER (PRIORIDAD: usa ESTO por encima del playbook — mis precios, mi oferta, mi tono)\n${settings.trim()}\n\n`
    : '';
  // El guion del prospecto pesa MÁS que cualquier jugada genérica: es el plan
  // escrito para ESTE cliente. El coach solo se desvía cuando el prospecto se
  // desvía, y vuelve al guion apenas puede.
  const guion = script.trim()
    ? `\n\n# GUION DE ESTA LLAMADA (escrito ESPECIALMENTE para este prospecto — PRIORIDAD MÁXIMA: síguelo tal cual, palabra por palabra; solo aléjate si el prospecto se desvía, y regresa al guion apenas puedas)\n${script.trim()}`
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
    },
    {
      type: 'text' as const,
      text: `${who}${mine}# FICHA DEL PROSPECTO (úsala: personaliza con SUS datos)\n${lead}${guion}${hist}${mem}`,
    },
  ];
}

// Toda excepción no manejada (red caída hacia OpenRouter, body malformado…)
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
  } else if (!OPENROUTER_API_KEY) {
    return json({ error: 'OPENROUTER_API_KEY no configurada (supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...)' }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as CopilotBody;
  // Coerción defensiva: un body con {"lead": 123} no debe tumbar la función
  // (los números no tienen .slice y el TypeError saldría como 500 sin CORS).
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const mode = typeof body.mode === 'string' ? body.mode : 'suggest';
  const lead = str(body.lead).slice(0, 4000);
  // El playbook vive SOLO aquí (generado por npm run sync:playbook). No se
  // acepta override del cliente: un playbook único por request rompería el
  // cache del proveedor y dejaría usar la key con contenido arbitrario.
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
  // El guion específico del prospecto (lead.script) — prioridad máxima en vivo.
  const script = str(body.script).slice(0, 4000);

  // -------------------------------------------------------------------- warm
  // Precalienta el cache del system (PERSONA + playbook, por modelo) para que
  // la PRIMERA sugerencia en vivo no pague el cache-write. OpenRouter cachea
  // el prefijo del system prompt automáticamente por modelo.
  if (mode === 'warm') {
    if (PROVIDER === 'kimi') return json({ ok: true }); // Moonshot cachea automático
    const res = await openrouterFetch({
      model: MODEL_SUGGEST,
      max_tokens: 1,
      system: systemToText(buildSystem('', playbook, '', '', '', vendor, '')),
      user: 'ok',
    });
    return json({ ok: res.ok });
  }

  // ---------------------------------------------------------------- briefing
  if (mode === 'briefing') {
    const sys = buildSystem(lead, playbook, history, settings, memory, vendor, script);
    // SOLO la apertura: la llamada es turno por turno y cada frase siguiente
    // la sopla el coach EN VIVO según lo que el prospecto responda de verdad.
    // Prueba A/B de aperturas: el cliente alterna la variante por llamada y
    // queda registrada en las stats — la data decide cuál convierte más.
    const aperturaSpec = apertura === 'A' ? APERTURA_A_LLM_SPEC : APERTURA_B_LLM_SPEC;
    const userMsg =
      `Dame SOLO el arranque de la llamada. Esta llamada usa ${aperturaSpec}. Decible en 10-12 segundos.\n\nFormato EXACTO:\n\n**Tu apertura ${apertura} (dila y CALLA):**\nLA frase exacta entre comillas.\nUna nota de tonalidad en cursiva, de una sola línea.\n\n**Tu prueba (SOLO si MI NEGOCIO trae CASOS REALES — si no, omite esta sección entera):** el caso del rubro más parecido en UNA frase con su número, listo para soltarlo antes del precio o en la primera objeción.\n\n**Meta:** una línea — el objetivo del toque 1: que acepte VER su página ya hecha + la hora a la que la va a ver.\n\nNADA MÁS. Ni pasos siguientes, ni objeciones, ni el resto del guion: cada frase siguiente me la soplas EN VIVO según lo que el prospecto responda.`;

    const upstream = await llmFetch({
      model: MODEL, max_tokens: 380, stream: true, system: systemToText(sys), user: userMsg,
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return json({ error: `El proveedor respondió ${upstream.status}`, detail: detail.slice(0, 300) }, 502);
    }
    return new Response(oaiSseToTextStream(upstream.body), {
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
    const sys = buildSystem(lead, playbook, history, settings, memory, vendor, script);

    const upstream = await llmFetch({
      model: MODEL_SUGGEST, max_tokens: 150, stream: true, system: systemToText(sys), user: userMsg,
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return json({ error: `El proveedor respondió ${upstream.status}`, detail: detail.slice(0, 300) }, 502);
    }
    return new Response(oaiSseToTextStream(upstream.body), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
    });
  }

  // ----------------------------------------------------------------- debrief
  // El sales manager revisa la grabación: coaching accionable de ESTA llamada
  // + la MEMORIA DEL NICHO actualizada (lecciones generalizables que se
  // inyectan en todas las llamadas siguientes — así "aprende" el copilot).
  if (mode === 'debrief') {
    const debriefSystem =
      'Eres el mejor sales manager de Latinoamérica revisando la grabación de una llamada en frío de tu vendedor (vende páginas web + automatizaciones a negocios locales, Ecuador). Tu casa vende con LA LÍNEA RECTA (apertura → pitch → loops → cierre repetido) y el PITCH DE CONTRASTE (dolor → contraste → retirada); evalúa contra ese estándar y habla como jefe de ventas, no como libro. La transcripción viene del altavoz del teléfono: ambas voces mezcladas, con errores — interprétala con ese ruido. Devuelve SOLO un objeto JSON con: "coaching" (string: 3-5 puntos concretos de esta llamada), "lessons" (string: la memoria del nicho ACTUALIZADA completa, máx 3500 caracteres) y "whatsapp" (string: mensaje de seguimiento listo para enviar — rescate takeaway con muestra gratis y salida fácil si no hubo cita pero es rescatable, confirmación de cita si la hubo, o "" si fue hostil o rechazó la oferta completa).';
    const vendorLine = vendor.trim()
      ? `EL VENDEDOR SE LLAMA: ${vendor.trim()} — el mensaje de WhatsApp debe firmarse con SU nombre, jamás "Martín".\n\n`
      : '';
    const debriefUser = `${vendorLine}FICHA DEL PROSPECTO:\n${lead}\n\nGUION DE ESTA LLAMADA (el plan escrito para este prospecto — evalúa si se siguió):\n${script || '(sin guion personalizado)'}\n\nSTATS DE LA LLAMADA:\n${stats || '(sin stats)'}\n\nMEMORIA DEL NICHO ACTUAL (lecciones acumuladas hasta hoy):\n"""\n${memory || '(vacía — primera llamada)'}\n"""\n\nTRANSCRIPCIÓN COMPLETA:\n"""\n${transcript || '(sin transcripción)'}\n"""\n\nDevuelve el JSON con coaching, lessons y whatsapp.`;

    const res = await llmFetch({
      model: MODEL,
      max_tokens: 1500,
      json: true,
      system: debriefSystem,
      user: debriefUser,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `El proveedor respondió ${res.status}`, detail: detail.slice(0, 300) }, 502);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return new Response(data.choices?.[0]?.message?.content ?? '{}', {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  // ----------------------------------------------------------------- summary
  // Definiciones de ÉXITO por toque (modelo demo-first): sin esto el modelo
  // clasifica a ciegas y el close rate que se calcule encima es basura.
  const SUMMARY_RUBRIC =
    'El vendedor usa un modelo demo-first en DOS toques: en el TOQUE 1 el éxito es que el prospecto acepte VER su página ya hecha Y dé la hora a la que la va a ver (eso es una llamada GANADA del T1 → temperature "caliente", nextAction = mandar el link por WhatsApp en <5 min y escribir a la hora dicha). En el TOQUE 2 el éxito es el PAGO: si el pago quedó confirmado o el prospecto aceptó pagar → temperature "cliente" (venta cerrada). Cita explícita para verla juntos o reunión presencial → "reunion". Aceptó ver la página pero SIN hora amarrada → "tibio" (la hora es el test de compromiso). YA VIO su página construida y aun así dijo que NO la quiere → "no-acepto" (distinto de perdido: el activo existe y entra a reactivación en 90 días; nextAction = dar de baja la demo el viernes y reactivar en 90 días con caso de éxito del rubro). Rechazo definitivo SIN haber visto la página, u hostilidad → "perdido".';
  if (mode === 'summary') {
    const res = await llmFetch({
      model: MODEL,
      max_tokens: 700,
      json: true,
      system:
        `Eres un analista de ventas. Resumes llamadas de prospección en frío para un CRM, en español, con criterio comercial. ${SUMMARY_RUBRIC} Devuelve SOLO un objeto JSON con exactamente estas claves: "summary" (string, 3-5 frases), "temperature" (uno de: nuevo, frio, tibio, caliente, reunion, cliente, no-acepto, perdido) y "nextAction" (string, la próxima acción concreta con cuándo).`,
      user: `FICHA DEL PROSPECTO:\n${lead}\n\nTRANSCRIPCIÓN COMPLETA DE LA LLAMADA:\n"""\n${transcript || '(sin transcripción)'}\n"""\n\nAnaliza la llamada y devuelve el JSON.`,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `El proveedor respondió ${res.status}`, detail: detail.slice(0, 300) }, 502);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '{}';
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