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
async function fetchProfile(id: string): Promise<User | null> {
  const { data } = await supabase!.from('profiles').select('*').eq('id', id).single();
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
    const user = await fetchProfile(data.user.id);
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
    const { data } = await supabase!.auth.getUser();
    if (!data.user) return null;
    const user = await fetchProfile(data.user.id);
    // A user deactivated while logged in loses access on the next restore. (audit#1 #9)
    if (!user || !user.active) {
      await supabase!.auth.signOut();
      return null;
    }
    return user;
  },

  onAuthChange(cb) {
    const { data } = supabase!.auth.onAuthStateChange(async (_event, sess) => {
      if (!sess?.user) {
        cb(null);
        return;
      }
      const user = await fetchProfile(sess.user.id);
      cb(user && user.active ? user : null);
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
