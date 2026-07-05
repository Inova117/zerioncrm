// ============================================================================
// Supabase Edge Function — create-employee
// ----------------------------------------------------------------------------
// This is the ONLY way an account gets created. It runs on the server with the
// service_role key, and it first verifies that the CALLER is an admin. That
// enforces the product rule: employees can never self-register; only the admin
// mints accounts (username + password) for their team.
//
// Deploy:  supabase functions deploy create-employee
// Call:    POST { name, email, password, role } with the caller's JWT in the
//          Authorization header (the app's usersService.create() does this).
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// CORS: the browser sends a preflight OPTIONS and expects these headers, or the
// request fails with "Failed to fetch" before your handler even runs. (bug #11)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Default avatar palette (kept in sync with src/lib/constants.ts AVATAR_COLORS).
const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';

  // 1) Identify the caller and confirm they are an admin.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: me } = await asCaller.auth.getUser();
  if (!me?.user) return json({ error: 'No autenticado' }, 401);

  const { data: profile } = await asCaller
    .from('profiles')
    .select('role')
    .eq('id', me.user.id)
    .single();
  if (profile?.role !== 'admin') return json({ error: 'Solo el administrador puede crear cuentas' }, 403);

  // 2) Create the auth user + profile with the service role.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { name, email, password, role = 'employee' } = await req.json();
  const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createErr) return json({ error: createErr.message }, 400);

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    email,
    name,
    role,
    avatar_color, // keep the profile complete (bug #25)
  });
  if (profileErr) {
    // Roll back the orphaned auth user so the admin can retry the same email
    // instead of hitting "email already registered" forever. (bug #23)
    const { error: rollbackErr } = await admin.auth.admin.deleteUser(created.user.id);
    if (rollbackErr) {
      // Rollback itself failed → surface BOTH so the operator can clean up the
      // now-orphaned auth user manually instead of a silent inconsistency.
      return json(
        { error: profileErr.message, rollbackError: rollbackErr.message, orphanUserId: created.user.id },
        500
      );
    }
    return json({ error: profileErr.message }, 400);
  }

  return json({ user: { id: created.user.id, email, name, role, avatar_color } }, 201);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
