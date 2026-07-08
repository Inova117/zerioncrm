import type { User } from '../types';
import { table, session, delay } from './db';
import { supabase } from '../lib/supabaseClient';
import { rowToUser } from './mappers';

export interface AuthResult {
  user: User | null;
  error: string | null;
}

export interface AuthService {
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  /** Subscribe to auth changes (login/logout/token refresh). Returns unsubscribe. */
  onAuthChange(cb: (user: User | null) => void): () => void;
}

// ---------------------------------------------------------------------------
// Supabase implementation (production)
// ---------------------------------------------------------------------------
/** Returns the profile, null if it genuinely doesn't exist (PGRST116), or THROWS
 *  on a transient/other error so callers can avoid destroying a valid session. (#10) */
async function fetchProfile(id: string): Promise<User | null> {
  const { data, error } = await supabase!.from('profiles').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? rowToUser(data) : null;
}

const supabaseAuthService: AuthService = {
  async signIn(email, password) {
    const { data, error } = await supabase!.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) {
      return { user: null, error: 'Correo o contraseña incorrectos.' };
    }
    let user: User | null;
    try {
      user = await fetchProfile(data.user.id);
    } catch {
      return { user: null, error: 'No se pudo cargar tu perfil. Intenta de nuevo.' };
    }
    if (!user) return { user: null, error: 'Tu perfil no existe. Contacta al administrador.' };
    if (!user.active) {
      await supabase!.auth.signOut();
      return { user: null, error: 'Tu cuenta está desactivada. Contacta al administrador.' };
    }
    return { user, error: null };
  },

  async signOut() {
    await supabase!.auth.signOut();
  },

  async getCurrentUser() {
    // getSession reads the persisted session locally (resilient offline/flaky). (#18)
    const { data } = await supabase!.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) return null;
    try {
      const user = await fetchProfile(authUser.id);
      // Genuinely missing profile or deactivated → end the session. (audit#1 #9)
      if (!user || !user.active) {
        await supabase!.auth.signOut();
        return null;
      }
      return user;
    } catch {
      // Transient profile-fetch error → keep the session, just no user this cycle. (#10)
      return null;
    }
  },

  onAuthChange(cb) {
    const { data } = supabase!.auth.onAuthStateChange(async (event, sess) => {
      // getCurrentUser() already handles the initial load; ignore its duplicate
      // INITIAL_SESSION event to avoid a last-writer-wins race. (#13)
      if (event === 'INITIAL_SESSION') return;
      if (!sess?.user) {
        cb(null);
        return;
      }
      try {
        const user = await fetchProfile(sess.user.id);
        if (!user || !user.active) {
          await supabase!.auth.signOut(); // deactivated → actually end the session (#19)
          cb(null);
          return;
        }
        cb(user);
      } catch {
        /* transient — keep the current UI user */
      }
    });
    return () => data.subscription.unsubscribe();
  },
};

// ---------------------------------------------------------------------------
// Mock implementation (local dev, no Supabase env)
// ---------------------------------------------------------------------------
const mockAuthService: AuthService = {
  async signIn(email, password) {
    await delay();
    const creds = table.get('credentials');
    const match = creds.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password
    );
    if (!match) return { user: null, error: 'Correo o contraseña incorrectos.' };
    const user = table.get('users').find((u) => u.id === match.userId) ?? null;
    if (!user) return { user: null, error: 'Usuario no encontrado.' };
    if (!user.active)
      return { user: null, error: 'Tu cuenta está desactivada. Contacta al administrador.' };
    session.set(user.id);
    return { user, error: null };
  },

  async signOut() {
    await delay(60);
    session.set(null);
  },

  async getCurrentUser() {
    const id = session.get();
    if (!id) return null;
    const user = table.get('users').find((u) => u.id === id) ?? null;
    if (!user || !user.active) {
      session.set(null);
      return null;
    }
    return user;
  },

  onAuthChange() {
    return () => {};
  },
};

export const authService: AuthService = supabase ? supabaseAuthService : mockAuthService;
