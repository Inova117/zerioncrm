// Prospección automática diaria — dispara la edge function run-campaign de
// Supabase cada mañana. Horario: '0 13 * * *' = 13:00 UTC = 08:00 Ecuador (UTC-5).
//
// Env vars de Netlify (server-side, NO VITE_):
//   SUPABASE_URL        → https://<ref>.supabase.co
//   CRON_SECRET         → el mismo secreto configurado en Supabase (run-campaign)
export default async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!SUPABASE_URL || !CRON_SECRET) {
    console.error('[prospeccion-diaria] faltan SUPABASE_URL o CRON_SECRET');
    return new Response('config error', { status: 500 });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/run-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
      body: JSON.stringify({ action: 'decide' }),
    });
    const data = await resp.json().catch(() => ({}));
    console.log('[prospeccion-diaria]', resp.status, JSON.stringify(data));
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[prospeccion-diaria]', String(e));
    return new Response(String(e), { status: 500 });
  }
};

export const config = { schedule: '0 13 * * *' };
