// ============================================================================
// Supabase client — wired but dormant.
// ----------------------------------------------------------------------------
// The whole app currently runs on the local mock layer (see src/services/db.ts),
// so nothing imports `supabase` yet. When you are ready to go live:
//
//   1. Create a project at https://supabase.com
//   2. Run supabase/schema.sql in the SQL editor
//   3. Copy .env.example → .env and fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
//   4. Flip USE_SUPABASE to true and swap the service implementations
//      (each service in src/services/* has a // SUPABASE: ... note showing the query)
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Master switch. Keep false until the .env is filled and the schema is applied. */
export const USE_SUPABASE = false;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(url && anonKey);
