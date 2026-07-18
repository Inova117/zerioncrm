// ============================================================================
// Supabase Edge Function — deepgram-token
// ----------------------------------------------------------------------------
// Acuña un token TEMPORAL de Deepgram (JWT de vida corta) para que el navegador
// pueda abrir el WebSocket de transcripción en vivo SIN exponer la master key.
//
// El navegador nunca ve la DEEPGRAM_API_KEY: pide aquí un token de ~60s, abre
// el WS de Deepgram con `?access_token=JWT`, y ese token muere solito.
//
//   body: { probe?: true }
//     probe → { available: boolean }            (solo dice si está configurado; no gasta token)
//     else  → { available, access_token, expires_in }  (token listo para el WS)
//
// Si DEEPGRAM_API_KEY no está seteada → { available: false } y el front cae
// elegantemente a la Web Speech API del navegador (sin romper nada).
//
// Deploy:  supabase functions deploy deepgram-token
// Secret:  supabase secrets set DEEPGRAM_API_KEY=<master key de Deepgram>
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY') ?? '';
// Vida del token temporal en segundos (10-3600). 60s basta: solo debe estar
// vivo durante el handshake del WebSocket; luego la conexión se mantiene sola.
// Un secret malformado ("60s" → NaN) cae a 60 en vez de mandar null a Deepgram.
const rawTtl = Number(Deno.env.get('DEEPGRAM_TOKEN_TTL') ?? '60');
const TTL_SECONDS = Number.isFinite(rawTtl) ? Math.min(Math.max(rawTtl, 10), 3600) : 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Excepciones no manejadas (red caída hacia Deepgram, etc.) salen como JSON
// CON CORS — el 500 pelado de Deno.serve el navegador lo disfraza de error CORS.
Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    return json({ error: 'Error interno de deepgram-token', detail: String(e).slice(0, 200) }, 500);
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
    .select('id, active')
    .eq('id', auth.user.id)
    .maybeSingle();
  // Un blip de la DB no es lo mismo que una cuenta inactiva: 503 ≠ 403.
  if (dbErr) return json({ error: 'No se pudo verificar la cuenta — reintenta' }, 503);
  if (!caller || caller.active === false) return json({ error: 'Cuenta inactiva' }, 403);

  // Sin master key configurada → el front usa Web Speech (fallback).
  if (!DEEPGRAM_API_KEY) return json({ available: false });

  const body = (await req.json().catch(() => ({}))) as { probe?: boolean };
  // Probe DIAGNÓSTICO: intenta un grant real (acuñar es gratis) y si falla,
  // devuelve el porqué exacto + la huella de la key que la función está usando.
  // Así la consola del navegador distingue "quedó la key vieja en el secret"
  // de "la key no tiene permisos" sin que nadie adivine.
  if (body.probe) {
    const fp = `${DEEPGRAM_API_KEY.slice(0, 4)}…${DEEPGRAM_API_KEY.slice(-4)} (${DEEPGRAM_API_KEY.length} chars)`;
    const test = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: 30 }),
    });
    if (!test.ok) {
      const detail = await test.text().catch(() => '');
      return json(
        {
          available: false,
          error: `Deepgram respondió ${test.status} usando la key ${fp}`,
          detail: detail.slice(0, 300),
        },
        502
      );
    }
    return json({ available: true });
  }

  // Acuñar el token temporal.
  const grant = await fetch('https://api.deepgram.com/v1/auth/grant', {
    method: 'POST',
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl_seconds: TTL_SECONDS }),
  });

  if (!grant.ok) {
    const detail = await grant.text().catch(() => '');
    return json({ available: false, error: `Deepgram respondió ${grant.status}`, detail: detail.slice(0, 300) }, 502);
  }

  const data = (await grant.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return json({ available: false, error: 'Deepgram no devolvió token' }, 502);

  return json({ available: true, access_token: data.access_token, expires_in: data.expires_in ?? TTL_SECONDS });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
