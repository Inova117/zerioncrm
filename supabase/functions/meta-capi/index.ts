// ============================================================================
// Supabase Edge Function — meta-capi  (Conversions API, OUTBOUND)
// ----------------------------------------------------------------------------
// Cuando un lead cambia de etapa en el CRM, esta función avisa a Meta vía la
// Conversions API (el flujo "Qualified Leads" / CRM). NO trae leads: le manda a
// Meta la SEÑAL DE CALIDAD para que el algoritmo de ads aprenda a quién mostrar
// los anuncios. El inbound (traer leads) es la función meta-leadgen.
//
//   body: { leadId: string, eventName: string, eventTime?: number,
//           testEventCode?: string }
//     leadId    → lead del CRM cuyo cambio de etapa disparó el evento
//     eventName → nombre del evento Meta (Lead, QualifiedLead, MeetingScheduled,
//                 Purchase…). El mapa etapa→evento vive en el CLIENTE; aquí solo
//                 se reenvía lo que llegue (validado contra una allow-list).
//     eventTime → UNIX seconds del cambio de etapa (default: ahora)
//     testEventCode → fuerza el envío al tab "Test Events" de Events Manager
//                     (override del secret META_TEST_EVENT_CODE)
//
// El navegador NUNCA ve el token ni hashea PII: manda solo el leadId; esta
// función carga el lead con service_role, hashea email/teléfono con SHA-256 y
// hace el POST a graph.facebook.com. El token vive SOLO aquí (secret).
//
// Seguridad: el caller debe estar autenticado y ser dueño del lead (o admin),
// igual que las RLS de la tabla leads. Nunca se envían eventos de leads ajenos.
//
// Deploy:  supabase functions deploy meta-capi
// Secrets: supabase secrets set META_CAPI_TOKEN=<access token del dataset>
//          supabase secrets set META_DATASET_ID=1561051434948784   (opcional; default abajo)
//          supabase secrets set META_TEST_EVENT_CODE=TESTxxxxx      (opcional; solo pruebas)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const META_CAPI_TOKEN = Deno.env.get('META_CAPI_TOKEN') ?? '';
// Dataset (antes "pixel") id. Default = el dataset de ZerionStudio de la guía.
// Override sin redeploy: supabase secrets set META_DATASET_ID=...
const META_DATASET_ID = Deno.env.get('META_DATASET_ID') ?? '1561051434948784';
const META_API_VERSION = Deno.env.get('META_API_VERSION') ?? 'v26.0';
// Si está seteado, TODOS los eventos van al tab Test Events (no afectan datos
// reales). Déjalo sin setear en producción. El body puede overridearlo.
const META_TEST_EVENT_CODE = Deno.env.get('META_TEST_EVENT_CODE') ?? '';

// El nombre del CRM que Meta muestra como origen del evento (custom_data).
const LEAD_EVENT_SOURCE = Deno.env.get('META_LEAD_EVENT_SOURCE') ?? 'ZerioCRM';

// Eventos permitidos: reflejan el embudo del CRM. Rechazar cualquier otro evita
// mandarle basura a Meta si el cliente manda un eventName equivocado.
const ALLOWED_EVENTS = new Set([
  'Lead',
  'QualifiedLead',
  'MeetingScheduled',
  'Purchase',
]);

// Versión visible en las cabeceras de TODA respuesta (incluido el preflight):
//   curl -sI -X OPTIONS <url>/functions/v1/meta-capi | grep x-meta-capi-version
// Súbela en cada cambio relevante — es la forma de verificar qué está deployado.
const VERSION = '2026-08-04.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'x-meta-capi-version': VERSION,
};

interface CapiBody {
  leadId?: string;
  eventName?: string;
  eventTime?: number;
  testEventCode?: string;
}

// Excepciones no manejadas salen como JSON CON CORS — el 500 pelado de
// Deno.serve el navegador lo disfraza de error CORS.
Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    return json({ error: 'Error interno de meta-capi', detail: String(e).slice(0, 200) }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Auth: usuario del CRM activo (mismo patrón que copilot / find-leads).
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await asCaller.auth.getUser();
  if (!auth?.user) return json({ error: 'No autenticado — vuelve a iniciar sesión' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: caller, error: dbErr } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (dbErr) return json({ error: 'No se pudo verificar la cuenta — reintenta' }, 503);
  if (!caller || caller.active === false) return json({ error: 'Cuenta inactiva' }, 403);

  const body = (await req.json().catch(() => ({}))) as CapiBody;
  const leadId = (body.leadId ?? '').trim();
  const eventName = (body.eventName ?? '').trim();
  if (!leadId) return json({ error: 'Falta leadId' }, 400);
  if (!ALLOWED_EVENTS.has(eventName)) {
    return json({ error: `eventName inválido: "${eventName}". Permitidos: ${[...ALLOWED_EVENTS].join(', ')}` }, 400);
  }

  // Sin token configurado: no es un error del usuario — la integración
  // simplemente no está activa. 200 + skipped para que el disparador
  // fire-and-forget del cliente no ensucie la consola con un fallo.
  if (!META_CAPI_TOKEN) return json({ ok: false, skipped: 'META_CAPI_TOKEN no configurado' });

  // Cargar el lead con service_role (necesitamos el PII para hashear). Luego
  // verificar que el caller PUEDE tocarlo, replicando las RLS de leads:
  // admin ve todo; empleado solo lo asignado a él.
  const { data: lead, error: leadErr } = await admin
    .from('leads')
    .select('id, assigned_to, email, phone, contact_name, meta_lead_id, fbclid')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr) return json({ error: 'No se pudo leer el lead — reintenta' }, 503);
  if (!lead) return json({ error: 'Lead no encontrado' }, 404);
  const isAdmin = caller.role === 'admin';
  if (!isAdmin && lead.assigned_to !== caller.id) {
    return json({ error: 'No autorizado para este lead' }, 403);
  }

  // ---- Construir user_data (todo el PII hasheado SHA-256, menos lead_id/fbc) ----
  const user_data: Record<string, unknown> = {};

  const em = normalizeEmail(lead.email);
  if (em) user_data.em = [await sha256(em)];

  const ph = normalizePhone(lead.phone);
  if (ph) user_data.ph = [await sha256(ph)];

  const { fn, ln } = splitName(lead.contact_name);
  if (fn) user_data.fn = [await sha256(fn)];
  if (ln) user_data.ln = [await sha256(ln)];

  // Llaves de match de máxima prioridad (NO se hashean).
  if (lead.meta_lead_id) user_data.lead_id = String(lead.meta_lead_id);
  // fbc debe ir en formato "fb.1.<ts>.<fbclid>"; solo lo mandamos si ya viene
  // así almacenado — un fbclid crudo malformado Meta lo rechaza.
  if (lead.fbclid && String(lead.fbclid).startsWith('fb.')) user_data.fbc = String(lead.fbclid);

  // Meta exige AL MENOS un parámetro de customer information para matchear.
  if (Object.keys(user_data).length === 0) {
    return json({ ok: false, skipped: 'El lead no tiene email/teléfono/lead_id para matchear con Meta' });
  }

  const eventTime = Number.isFinite(body.eventTime)
    ? Math.floor(body.eventTime as number)
    : Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    data: [
      {
        action_source: 'system_generated',
        event_name: eventName,
        event_time: eventTime,
        custom_data: {
          event_source: 'crm',
          lead_event_source: LEAD_EVENT_SOURCE,
        },
        user_data,
      },
    ],
  };

  const testCode = (body.testEventCode ?? '').trim() || META_TEST_EVENT_CODE;
  if (testCode) payload.test_event_code = testCode;

  // ---- POST a Graph API. El token va en el body (no en la URL) para no
  // filtrarlo en logs/redirects. ----
  const url = `https://graph.facebook.com/${META_API_VERSION}/${META_DATASET_ID}/events`;
  const metaRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, access_token: META_CAPI_TOKEN }),
  });

  const metaJson = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok) {
    // Devolvemos el error de Meta (recortado) para diagnosticar en consola, pero
    // NUNCA el token. Graph API nunca lo refleja, así que el body es seguro.
    return json(
      {
        ok: false,
        status: metaRes.status,
        error: 'Meta rechazó el evento',
        detail: metaJson,
        sent: { eventName, eventTime, matchKeys: Object.keys(user_data), test: Boolean(testCode) },
      },
      502
    );
  }

  return json({
    ok: true,
    eventName,
    eventTime,
    matchKeys: Object.keys(user_data),
    test: Boolean(testCode),
    meta: metaJson, // { events_received, messages, fbtrace_id }
  });
}

// ---------------------------------------------------------------------------
// Normalización + hashing (reglas de Meta)
//   https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
// ---------------------------------------------------------------------------

/** email: minúsculas + trim. '' si no hay dato válido. */
function normalizeEmail(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  return s.includes('@') ? s : '';
}

/** phone: solo dígitos, con código de país, sin '+' ni ceros de marcación.
 *  Meta pide E.164 sin el '+'. No adivinamos código de país: si el número no
 *  trae suficientes dígitos lo mandamos igual (Meta hace su propio matching),
 *  pero descartamos basura de <7 dígitos. '' si no hay dato usable. */
function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D+/g, '');
  return digits.length >= 7 ? digits : '';
}

/** contact_name → { fn, ln } normalizados (minúsculas, sin espacios extra).
 *  Primer token = nombre; el resto = apellido. '' cuando no hay dato. */
function splitName(raw: unknown): { fn: string; ln: string } {
  const parts = String(raw ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { fn: '', ln: '' };
  if (parts.length === 1) return { fn: parts[0], ln: '' };
  return { fn: parts[0], ln: parts.slice(1).join(' ') };
}

/** SHA-256 hex (lo que Meta espera para em/ph/fn/ln). */
async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
