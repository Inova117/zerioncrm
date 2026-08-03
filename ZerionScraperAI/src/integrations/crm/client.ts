// ---------------------------------------------------------------------------
// Zerion CRM (Supabase) client — service_role, server-side only.
//
// The scraper is trusted server-side code, so it talks to the CRM's Supabase
// with the service_role key (bypasses RLS to insert prospectos on René's
// behalf). NEVER expose this key to a browser.
// ---------------------------------------------------------------------------
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../lib/env.js';

let client: SupabaseClient | undefined;

/** True when every piece needed to push into the CRM is configured. */
export function isCrmConfigured(): boolean {
  return Boolean(
    env.CRM_SUPABASE_URL && env.CRM_SUPABASE_SERVICE_ROLE_KEY && env.CRM_ASSIGN_TO_EMAIL,
  );
}

/** Lazily build the service_role Supabase client (throws if misconfigured). */
export function getCrmClient(): SupabaseClient {
  if (!env.CRM_SUPABASE_URL || !env.CRM_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'CRM no configurado — define CRM_SUPABASE_URL y CRM_SUPABASE_SERVICE_ROLE_KEY en .env',
    );
  }
  if (!client) {
    client = createClient(env.CRM_SUPABASE_URL, env.CRM_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
