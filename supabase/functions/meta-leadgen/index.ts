// ============================================================================
// Supabase Edge Function — meta-leadgen  (Meta Lead Ads webhook, INBOUND)
// ----------------------------------------------------------------------------
// Trae los leads de los formularios de Facebook/Instagram Lead Ads al CRM. Este
// es el flujo que de verdad "mete leads en ZerioCRM"; el outbound (meta-capi)
// solo manda señal de calidad a los ads.
//
//   GET  → verificación del webhook. Meta manda hub.mode/hub.verify_token/
//          hub.challenge; devolvemos el challenge SÓLO si el verify_token
//          coincide con META_VERIFY_TOKEN.
//   POST → notificación de lead nuevo. Verificamos la firma HMAC
//          (X-Hub-Signature-256 con META_APP_SECRET sobre el body crudo),
//          sacamos el leadgen_id, bajamos los datos del lead de la Graph API
//          con el Page Access Token, y lo insertamos como prospecto 'nuevo'.
//
// El lead entra con source='meta' y meta_lead_id = leadgen_id — esa misma llave
// es la que meta-capi usa después para el match perfecto en la Conversions API
// cuando el lead avanza de etapa. Así inbound y outbound quedan enlazados.
//
// IDEMPOTENCIA: meta_lead_id tiene índice único (ver migración). Si Meta
// reintenta el webhook (lo hace si no respondes 200 en ~20s), el segundo insert
// choca y lo tratamos como duplicado, sin crear un lead repetido.
//
// IMPORTANTE — deploy SIN verificación de JWT (el caller es Meta, no un usuario):
//   supabase functions deploy meta-leadgen --no-verify-jwt
// Secrets:
//   supabase secrets set META_VERIFY_TOKEN=<string que tú inventas, va también en Meta>
//   supabase secrets set META_APP_SECRET=<App Secret de tu app de Meta>
//   supabase secrets set META_PAGE_TOKEN=<Page Access Token con permiso leads_retrieval>
//   supabase secrets set META_DEFAULT_ASSIGNEE=<uuid del profile dueño; opcional>
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') ?? '';
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') ?? '';
const META_PAGE_TOKEN = Deno.env.get('META_PAGE_TOKEN') ?? '';
const META_DEFAULT_ASSIGNEE = Deno.env.get('META_DEFAULT_ASSIGNEE') ?? '';
const META_API_VERSION = Deno.env.get('META_API_VERSION') ?? 'v26.0';

const VERSION = '2026-08-04.1';

// No CORS: el caller es Meta (server-to-server), no un navegador.
Deno.serve(async (req) => {
  try {
    if (req.method === 'GET') return handleVerify(req);
    if (req.method === 'POST') return await handleEvent(req);
    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    // Respondemos 200 igual: un 500 hace que Meta reintente en loop. Logueamos.
    console.error('[meta-leadgen] error no manejado:', e);
    return json({ ok: false, error: String(e).slice(0, 200) }, 200);
  }
});

// ---------------------------------------------------------------------------
// GET — verificación del webhook (handshake inicial de Meta)
// ---------------------------------------------------------------------------
function handleVerify(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === META_VERIFY_TOKEN && challenge) {
    // Meta espera el challenge crudo (text/plain), no JSON.
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — llegó un lead nuevo
// ---------------------------------------------------------------------------
async function handleEvent(req: Request): Promise<Response> {
  // 1) Leer el body CRUDO (necesario para verificar la firma byte a byte).
  const raw = await req.text();

  // 2) Verificar la firma HMAC-SHA256. Sin App Secret configurado NO procesamos
  //    (fail-closed): un webhook sin verificar podría inyectar leads falsos.
  if (!META_APP_SECRET) {
    console.error('[meta-leadgen] META_APP_SECRET no configurado — rechazando');
    return json({ ok: false, error: 'no configurado' }, 200);
  }
  const sig = req.headers.get('x-hub-signature-256') ?? '';
  const valid = await verifySignature(raw, sig, META_APP_SECRET);
  if (!valid) {
    console.warn('[meta-leadgen] firma inválida — descartando');
    return new Response('invalid signature', { status: 401 });
  }

  // 3) Parsear el payload del webhook.
  let payload: MetaWebhook;
  try {
    payload = JSON.parse(raw) as MetaWebhook;
  } catch {
    return json({ ok: false, error: 'body no es JSON' }, 200);
  }
  if (payload.object !== 'page') {
    // Otros objetos (instagram, etc.) también llegan como 'page' para leadgen;
    // cualquier otro no nos interesa.
    return json({ ok: true, ignored: payload.object });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Resolver el dueño por defecto UNA vez para todo el batch.
  const assignee = await resolveAssignee(admin);
  if (!assignee) {
    console.error('[meta-leadgen] no hay profile para asignar el lead');
    return json({ ok: false, error: 'sin assignee' }, 200);
  }

  let created = 0;
  let duplicates = 0;
  let failed = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;
      try {
        const result = await ingestLead(admin, String(leadgenId), assignee);
        if (result === 'created') created++;
        else if (result === 'duplicate') duplicates++;
      } catch (e) {
        failed++;
        console.error(`[meta-leadgen] falló el lead ${leadgenId}:`, e);
      }
    }
  }

  return json({ ok: true, created, duplicates, failed });
}

// ---------------------------------------------------------------------------
// Bajar UN lead de la Graph API e insertarlo
// ---------------------------------------------------------------------------
async function ingestLead(
  admin: ReturnType<typeof createClient>,
  leadgenId: string,
  assignee: string
): Promise<'created' | 'duplicate'> {
  if (!META_PAGE_TOKEN) throw new Error('META_PAGE_TOKEN no configurado');

  // Corto-circuito de idempotencia: si ya existe, no volvemos a pegarle a Graph.
  const { data: existing } = await admin
    .from('leads')
    .select('id')
    .eq('meta_lead_id', leadgenId)
    .maybeSingle();
  if (existing) return 'duplicate';

  // Traer los datos del formulario.
  const url =
    `https://graph.facebook.com/${META_API_VERSION}/${leadgenId}` +
    `?fields=field_data,created_time,form_id,ad_id,campaign_name` +
    `&access_token=${encodeURIComponent(META_PAGE_TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Graph API ${res.status}: ${detail.slice(0, 200)}`);
  }
  const lead = (await res.json()) as GraphLead;
  const fields = mapFieldData(lead.field_data ?? []);

  // Construir la fila. source='meta', temperature='nuevo', meta_lead_id = llave.
  const maxPos = await maxPosition(admin);
  const company =
    fields.company_name ||
    fields.full_name ||
    [fields.first_name, fields.last_name].filter(Boolean).join(' ') ||
    'Lead de Meta';
  const contactName =
    fields.full_name || [fields.first_name, fields.last_name].filter(Boolean).join(' ') || '';

  const row = {
    company,
    contact_name: contactName,
    role: fields.job_title ?? '',
    email: fields.email ?? '',
    phone: fields.phone_number ?? '',
    website: '',
    industry: '',
    source: 'meta',
    channel: `Meta Lead Ads${lead.campaign_name ? ` · ${lead.campaign_name}` : ''}`,
    reason: 'Llenó un formulario de Facebook/Instagram Lead Ads',
    temperature: 'nuevo',
    service: 'otro',
    value: 0,
    mrr: 0,
    position: maxPos + 1,
    assigned_to: assignee,
    meta_lead_id: leadgenId,
    last_contact_at: lead.created_time ?? new Date().toISOString(),
  };

  // Insert idempotente: el índice único en meta_lead_id absorbe una carrera con
  // un reintento concurrente de Meta y lo marca como duplicado en vez de crear 2.
  const { data: inserted, error } = await admin
    .from('leads')
    .upsert(row, { onConflict: 'meta_lead_id', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return inserted ? 'created' : 'duplicate';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Verifica X-Hub-Signature-256 = "sha256=<hmac hex>" del body con el App Secret. */
async function verifySignature(raw: string, header: string, secret: string): Promise<boolean> {
  const expected = header.startsWith('sha256=') ? header.slice('sha256='.length) : '';
  if (!expected) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const got = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(got, expected.toLowerCase());
}

/** Comparación en tiempo constante (evita timing attacks sobre la firma). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** field_data de Meta ([{name, values:[...]}]) → objeto plano de strings. */
function mapFieldData(fd: GraphField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fd) {
    if (!f?.name) continue;
    const v = Array.isArray(f.values) && f.values.length ? String(f.values[0]).trim() : '';
    if (v) out[f.name] = v;
  }
  return out;
}

/** Dueño del lead: META_DEFAULT_ASSIGNEE si es un profile válido; si no, el
 *  primer admin; si no hay admin, cualquier profile. null si la tabla está vacía. */
async function resolveAssignee(admin: ReturnType<typeof createClient>): Promise<string | null> {
  if (META_DEFAULT_ASSIGNEE) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('id', META_DEFAULT_ASSIGNEE)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (adminProfile?.id) return adminProfile.id as string;

  const { data: any } = await admin
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (any?.id as string) ?? null;
}

/** max(position) en la columna 'nuevo' (mismo criterio que el cliente/mock). */
async function maxPosition(admin: ReturnType<typeof createClient>): Promise<number> {
  const { data } = await admin
    .from('leads')
    .select('position')
    .eq('temperature', 'nuevo')
    .order('position', { ascending: false })
    .limit(1);
  return data && data.length ? ((data[0] as { position?: number }).position ?? 0) : 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-meta-leadgen-version': VERSION },
  });
}

// ---------------------------------------------------------------------------
// Tipos del payload de Meta
// ---------------------------------------------------------------------------
interface MetaWebhook {
  object?: string;
  entry?: MetaEntry[];
}
interface MetaEntry {
  id?: string;
  time?: number;
  changes?: MetaChange[];
}
interface MetaChange {
  field?: string;
  value?: { leadgen_id?: string | number; page_id?: string; form_id?: string; created_time?: number };
}
interface GraphLead {
  field_data?: GraphField[];
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  campaign_name?: string;
}
interface GraphField {
  name?: string;
  values?: string[];
}
