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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// Opus 4.8 por defecto (calidad máxima de venta). Cambiable sin redeploy:
//   supabase secrets set COPILOT_MODEL=claude-haiku-4-5   (más barato/rápido)
const MODEL = Deno.env.get('COPILOT_MODEL') ?? 'claude-opus-4-8';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PERSONA = `Eres un coach de ventas de élite que susurra al oído de un vendedor DURANTE una llamada en frío. Combinas la Línea Recta de Jordan Belfort, la mentalidad de Grant Cardone, SPIN Selling y Challenger. El vendedor vende desarrollo de páginas web y automatizaciones a negocios locales (ZerionStudio).

REGLAS DE ORO:
- Responde SOLO con lo accionable: qué decir o qué preguntar AHORA. Sin preámbulos, sin teoría, sin meta-comentarios.
- Máximo 2-4 frases (el vendedor está EN la llamada y lee de reojo).
- Español neutro latinoamericano, frases listas para decirse en voz alta.
- La transcripción viene del altavoz del teléfono: mezcla la voz del vendedor y del prospecto, con errores de transcripción. Interprétala con ese ruido.
- Si detectas objeción → da la respuesta exacta (acuerda primero, luego redirige). Si detectas señal de compra → di que CIERRE ya, con el cierre alternativo. Si la conversación va bien → la siguiente pregunta SPIN.
- Formato: **negrita** para la frase a decir. Una nota breve en cursiva solo si hace falta.`;

interface CopilotBody {
  mode?: string;
  lead?: string;
  playbook?: string;
  transcript?: string;
  trigger?: string;
  history?: string;
  settings?: string;
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

// Nota caching: el playbook + ficha van en `system` con cache_control. En
// Opus 4.8 el prefijo mínimo cacheable es ~4096 tokens; si el playbook aún es
// más corto simplemente no cachea (sin error). Cuando crezca (Fase 2), las
// sugerencias de una misma llamada pagarán ~0.1x el input.
function buildSystem(lead: string, playbook: string, history: string, settings: string) {
  const mine = settings.trim()
    ? `\n\n# MI NEGOCIO Y MI FORMA DE VENDER (PRIORIDAD: usa ESTO por encima del playbook genérico — mis precios, mi oferta, mi tono)\n${settings.trim()}`
    : '';
  const hist = history.trim()
    ? `\n\n# HISTORIAL CON ESTE PROSPECTO (ya lo conoces — NO arranques de cero, referencia lo previo)\n${history.trim()}`
    : '';
  return [
    {
      type: 'text' as const,
      text: `${PERSONA}\n\n# PLAYBOOK DE VENTAS\n${playbook}${mine}\n\n# FICHA DEL PROSPECTO (úsala: personaliza con SUS datos)\n${lead}${hist}`,
      cache_control: { type: 'ephemeral' as const },
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

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY no configurada (supabase secrets set ANTHROPIC_API_KEY=...)' }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as CopilotBody;
  const mode = body.mode ?? 'suggest';
  const lead = (body.lead ?? '').slice(0, 4000);
  const playbook = (body.playbook ?? '').slice(0, 40000);
  const transcript = (body.transcript ?? '').slice(-6000);
  const trigger = (body.trigger ?? '').slice(0, 500);
  const settings = (body.settings ?? '').slice(0, 4000);
  const history = (body.history ?? '').slice(0, 4000);

  // ---------------------------------------------------------------- briefing
  if (mode === 'briefing') {
    const upstream = await anthropicFetch({
      model: MODEL,
      max_tokens: 700,
      stream: true,
      system: buildSystem(lead, playbook, history, settings),
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content:
            'Prepárame para llamar AHORA a este prospecto. Dame: (1) el ángulo de apertura exacto entre comillas, personalizado con sus datos; (2) las 3 objeciones más probables de ESTE negocio con la respuesta de una línea para cada una; (3) la meta concreta de la llamada y el cierre a usar. Directo y en formato compacto con **negritas**.',
        },
      ],
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
    const upstream = await anthropicFetch({
      model: MODEL,
      max_tokens: 300,
      stream: true,
      system: buildSystem(lead, playbook, history, settings),
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `TRANSCRIPCIÓN RECIENTE DE LA LLAMADA (mic en altavoz, ambas voces mezcladas):\n"""\n${transcript || '(la llamada acaba de empezar)'}\n"""\n\n${ask}`,
        },
      ],
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
