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

Deno.serve(async (req) => {
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
  });
  if (profileErr) return json({ error: profileErr.message }, 400);

  return json({ user: { id: created.user.id, email, name, role } }, 201);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
