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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// Opus 4.8 por defecto (calidad máxima de venta). Cambiable sin redeploy:
//   supabase secrets set COPILOT_MODEL=claude-haiku-4-5   (más barato/rápido)
const MODEL = Deno.env.get('COPILOT_MODEL') ?? 'claude-opus-4-8';
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PERSONA = `Eres "el Closer": la fusión de Jordan Belfort (Línea Recta, tonalidad, looping), Grant Cardone (acordar siempre, cierres, precio), Chris Voss (labels, preguntas calibradas, empatía táctica), Jeremy Miner/NEPQ (neutralidad curiosa, desapego, preguntas de consecuencia) y SPIN/Challenger — pero NO citas metodologías: HABLAS como el mejor vendedor que existe. Le susurras al oído a un vendedor DURANTE una llamada en frío real. Él vende páginas web y automatizaciones a negocios locales (ZerionStudio). Tu único trabajo: que cierre ESTA llamada.

CÓMO PIENSAS (proceso interno — jamás lo expliques en la respuesta):
1. Detecta el MOMENTO de la llamada: gatekeeper, apertura, descubrimiento, pitch, objeción, precio, señal de compra, peligro de colgar, cierre. El cliente puede mandarte su detección: confírmala o corrígela leyendo la transcripción.
2. Juega LA jugada de ESE momento según el playbook: objeción → acordar + loop (nunca contradecir); señal de compra → dejar de presentar y cerrar YA con alternativa; peligro → rescate de 15 segundos con un dato SUYO; descubrimiento → la siguiente pregunta que cuantifica el dolor; precio → cuantificar retorno con SUS números, jamás defender ni bajar el precio de una; gatekeeper → aliado, nombre y hora, sin pitchear.
3. Personaliza SIEMPRE con la ficha y el historial del prospecto, y con la oferta real del vendedor (MI NEGOCIO tiene prioridad sobre el playbook).

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
}

// --- Llamada a Anthropic (raw HTTP; streaming SSE → texto plano) ------------
interface AnthropicRequest {
  model: string;
  max_tokens: number;
  stream?: boolean;
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Array<{ role: 'user'; content: string }>;
  output_config?: Record<string, unknown>;
}

async function anthropicFetch(req: AnthropicRequest): Promise<Response> {
  return await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(req),
  });
}

/** Convierte el SSE de Anthropic en un stream de texto plano (solo text_delta). */
function sseToTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
              controller.enqueue(encoder.encode(evt.delta.text));
            }
          } catch {
            /* línea SSE parcial/no-JSON: ignorar */
          }
        }
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
  return await fetch(`${KIMI_BASE_URL}/chat/completions`, {
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
}

/** Convierte el SSE OpenAI-compatible en un stream de texto plano. */
function oaiSseToTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = evt.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            /* línea parcial: ignorar */
          }
        }
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
function buildSystem(lead: string, playbook: string, history: string, settings: string) {
  const mine = settings.trim()
    ? `# MI NEGOCIO Y MI FORMA DE VENDER (PRIORIDAD: usa ESTO por encima del playbook — mis precios, mi oferta, mi tono)\n${settings.trim()}\n\n`
    : '';
  const hist = history.trim()
    ? `\n\n# HISTORIAL CON ESTE PROSPECTO (ya lo conoces — NO arranques de cero, referencia lo previo)\n${history.trim()}`
    : '';
  return [
    {
      type: 'text' as const,
      text: `${PERSONA}\n\n# PLAYBOOK DE VENTAS (tu conocimiento de closer — aplícalo, no lo cites)\n${playbook}`,
      cache_control: { type: 'ephemeral' as const },
    },
    {
      type: 'text' as const,
      text: `${mine}# FICHA DEL PROSPECTO (úsala: personaliza con SUS datos)\n${lead}${hist}`,
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Auth: usuario del CRM activo (mismo patrón que find-leads).
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await asCaller.auth.getUser();
  if (!auth?.user) return json({ error: 'No autenticado — vuelve a iniciar sesión' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: caller } = await admin
    .from('profiles')
    .select('id, active')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!caller || caller.active === false) return json({ error: 'Cuenta inactiva' }, 403);

  if (PROVIDER === 'kimi') {
    if (!KIMI_API_KEY) return json({ error: 'KIMI_API_KEY no configurada (COPILOT_PROVIDER=kimi requiere supabase secrets set KIMI_API_KEY=...)' }, 500);
  } else if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY no configurada (supabase secrets set ANTHROPIC_API_KEY=...)' }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as CopilotBody;
  const mode = body.mode ?? 'suggest';
  const lead = (body.lead ?? '').slice(0, 4000);
  // El playbook vive AQUÍ (generado por npm run sync:playbook) — el cliente ya
  // no lo sube en cada request (~58KB menos de payload). body.playbook queda
  // como override de compatibilidad/experimentos.
  const playbook = (body.playbook && body.playbook.length > 0 ? body.playbook : PLAYBOOK).slice(0, 90000);
  const transcript = (body.transcript ?? '').slice(-6000);
  const trigger = (body.trigger ?? '').slice(0, 500);
  const settings = (body.settings ?? '').slice(0, 4000);
  const history = (body.history ?? '').slice(0, 4000);
  const moment = (body.moment ?? '').slice(0, 600);

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
      system: buildSystem('', playbook, '', ''),
      messages: [{ role: 'user', content: 'ok' }],
    });
    return json({ ok: res.ok });
  }

  // ---------------------------------------------------------------- briefing
  if (mode === 'briefing') {
    const sys = buildSystem(lead, playbook, history, settings);
    const userMsg =
      'Prepárame para llamar AHORA a este prospecto. Dame: (1) el ángulo de apertura exacto entre comillas, personalizado con sus datos; (2) las 3 objeciones más probables de ESTE negocio con la respuesta de una línea para cada una; (3) la meta concreta de la llamada y el cierre a usar. Directo y en formato compacto con **negritas**.';

    if (PROVIDER === 'kimi') {
      const upstream = await openaiFetch({
        model: KIMI_MODEL, max_tokens: 700, stream: true, system: systemToText(sys), user: userMsg,
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
      max_tokens: 700,
      stream: true,
      system: sys,
      output_config: { effort: 'low' },
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
    // "Frase primero": con streaming, el vendedor tiene la frase decible en
    // TTFT+~200ms y el porqué llega mientras ya la está usando.
    const userMsg = `${momentLine}TRANSCRIPCIÓN RECIENTE DE LA LLAMADA (mic en altavoz, ambas voces mezcladas):\n"""\n${transcript || '(la llamada acaba de empezar)'}\n"""\n\n${ask}\n\nFORMATO OBLIGATORIO: línea 1 = SOLO la frase exacta para decir en voz alta (máx 15 palabras), en **negrita**. Línea 2 (opcional) = una sola oración en cursiva con la tonalidad o el porqué.`;
    const sys = buildSystem(lead, playbook, history, settings);

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
      output_config: { effort: 'low' },
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

  // ----------------------------------------------------------------- summary
  if (mode === 'summary') {
    if (PROVIDER === 'kimi') {
      const res = await openaiFetch({
        model: KIMI_MODEL,
        max_tokens: 700,
        json: true,
        system:
          'Eres un analista de ventas. Resumes llamadas de prospección en frío para un CRM, en español, con criterio comercial. Devuelve SOLO un objeto JSON con exactamente estas claves: "summary" (string, 3-5 frases), "temperature" (uno de: nuevo, frio, tibio, caliente, reunion, perdido) y "nextAction" (string, la próxima acción concreta con cuándo).',
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
      system: [
        {
          type: 'text',
          text: 'Eres un analista de ventas. Resumes llamadas de prospección en frío para un CRM, en español, con criterio comercial.',
        },
      ],
      output_config: {
        effort: 'low',
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
                enum: ['nuevo', 'frio', 'tibio', 'caliente', 'reunion', 'perdido'],
                description: 'Etapa sugerida según el interés real mostrado.',
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
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
