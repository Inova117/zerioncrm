// ============================================================================
// Supabase Edge Function — admin-users
// ----------------------------------------------------------------------------
// The ONLY way privileged user operations happen. Runs on the server with the
// service_role key, and first verifies the CALLER is an admin. Enforces the
// product rule: employees never self-register; only the admin manages accounts.
//
//   action: 'create'       { name, email, password, role } → creates auth user
//                            (a DB trigger creates the matching profile row)
//   action: 'set-password' { userId, password }            → resets a password
//   action: 'delete'       { userId }                      → deletes the auth user
//                            (profile cascades; comments.author_id → null)
//
// Deploy:  supabase functions deploy admin-users
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1) Verify the caller is an authenticated admin.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: me } = await asCaller.auth.getUser();
  if (!me?.user) return json({ error: 'No autenticado' }, 401);
  const { data: profile } = await asCaller.from('profiles').select('role').eq('id', me.user.id).single();
  if (profile?.role !== 'admin') return json({ error: 'Solo el administrador puede gestionar cuentas' }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  // 2) Dispatch.
  if (action === 'create') {
    const { name, email, password } = body;
    // Only allow known roles; anything else would abort the profile trigger's ::role_t cast. (#26)
    const role = body.role === 'admin' ? 'admin' : 'employee';
    if (!email || !password || password.length < 6) {
      return json({ error: 'Correo y contraseña (mín. 6) son obligatorios' }, 400);
    }
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, avatar_color }, // the DB trigger builds the profile from this
    });
    if (error) return json({ error: error.message }, 400);
    // Return the profile the trigger just created (keeps the client's shape).
    const { data: prof } = await admin.from('profiles').select('*').eq('id', created.user.id).single();
    return json({ user: prof }, 201);
  }

  if (action === 'set-password') {
    const { userId, password } = body;
    if (!userId || !password || password.length < 6) return json({ error: 'Datos inválidos' }, 400);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === 'delete') {
    const { userId, reassignTo } = body;
    if (!userId) return json({ error: 'userId requerido' }, 400);
    if (userId === me.user.id) return json({ error: 'No puedes eliminar tu propia cuenta' }, 400);
    // Reassign this user's rows FIRST (service_role) so deleting the profile can't
    // violate the assigned_to FK; then delete the auth user. (#16)
    if (reassignTo) {
      await admin.from('leads').update({ assigned_to: reassignTo }).eq('assigned_to', userId);
      await admin.from('tasks').update({ assigned_to: reassignTo }).eq('assigned_to', userId);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: `Acción desconocida: ${action}` }, 400);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
