// ============================================================================
// Supabase Edge Function — enrich-linkedin
// ----------------------------------------------------------------------------
// Enriquecimiento de empresas vía LinkedIn: dado un lote de URLs de empresa
// (linkedin.com/company/...), devuelve employeeCount, founded, size, HQ, etc.
// Sirve para alimentar las señales de facturación del Minero (empleados +
// antigüedad) sin pedir nada a mano.
//
//   POST { urls: string[] }  →  { results: [{ inputUrl, success, name,
//        employeeCount, size, founded, headquarters, industry }] }
//
// Síncrono (run-sync-get-dataset-items): un lote de ≤20 URLs tarda segundos.
// El navegador no puede correr Apify; el token vive server-side (mismo
// APIFY_TOKEN que find-leads).
//
// Deploy:  supabase functions deploy enrich-linkedin
// Secret:  supabase secrets set APIFY_TOKEN=apify_api_xxx  (compartido)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ?? '';

// LinkedIn company scraper (scrapier/linkedin-company-scraper-actor).
// Pinned por ID para que un rename no nos rompa. Slug: scrapier~linkedin-company-scraper-actor.
const ACTOR = 'QWpwDW5AN5yRbE3Rk';
const MAX_URLS = 20;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

interface RawCompany {
  inputUrl?: string;
  success?: boolean;
  name?: string | null;
  employeeCount?: number | null;
  size?: string | null;
  founded?: number | null;
  headquarters?: string | null;
  industry?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Autenticado (cualquier usuario activo del CRM; es enriquecimiento read-only).
  const authHeader = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authErr } = await asCaller.auth.getUser();
  if (authErr || !auth?.user) {
    return json({ error: 'No autenticado — vuelve a iniciar sesión' }, 401);
  }

  if (!APIFY_TOKEN) return json({ error: 'APIFY_TOKEN no configurado en la Edge Function' }, 500);

  const body = await req.json().catch(() => ({}));
  const urls = (Array.isArray(body.urls) ? body.urls : [])
    .filter((u: unknown) => typeof u === 'string' && /linkedin\.com\/company\//i.test(u as string))
    .slice(0, MAX_URLS);

  if (!urls.length) return json({ results: [] });

  let items: RawCompany[];
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, concurrency: 3, maxRetries: 2 }),
      }
    );
    if (!resp.ok) return json({ error: `LinkedIn scrape falló (${resp.status})` }, 502);
    items = (await resp.json()) as RawCompany[];
  } catch (e) {
    return json({ error: `Error llamando a Apify: ${String(e)}` }, 502);
  }

  const results = items.map((it) => ({
    inputUrl: it.inputUrl ?? null,
    success: it.success === true,
    name: it.name ?? null,
    employeeCount: typeof it.employeeCount === 'number' ? it.employeeCount : null,
    size: it.size ?? null,
    founded: typeof it.founded === 'number' ? it.founded : null,
    headquarters: it.headquarters ?? null,
    industry: it.industry ?? null,
  }));

  return json({ results });
});
