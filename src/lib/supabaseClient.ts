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
//
// TWO THINGS TO HANDLE DURING INTEGRATION (they don't bite in the mock layer):
//
//  • camelCase ⇆ snake_case (bug #12): the TS types use camelCase
//    (assignedTo, lastContactAt, meetingAt…) but the SQL columns are snake_case
//    (assigned_to, last_contact_at, meeting_at…). A raw select('*') returns
//    snake_case keys, so fields would read as `undefined` across the app. Map at
//    the service boundary — either add row→model / model→row mappers in each
//    service, or expose the columns aliased (e.g. `select('assigned_to as
//    assignedTo, ...')`). Keep the mapping in ONE place so components never see
//    raw rows.
//
//  • Role scoping (bug #22): today every logged-in client loads all rows and the
//    UI filters by role for presentation only — fine for a mock, NOT a security
//    boundary. With Supabase the RLS policies in supabase/schema.sql are the real
//    boundary (admin sees all; each employee only their own). Don't rely on the
//    client filter for security; trust RLS.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * When true, the services talk to Supabase; when false they use the local mock.
 * This is now driven purely by whether .env has the Supabase vars — set them and
 * you're in production; remove them and you're back to the local mock for dev.
 */
export const USE_SUPABASE = isSupabaseConfigured;
