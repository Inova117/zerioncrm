import type { User } from '../types';
import { table, session, delay } from './db';

export interface AuthResult {
  user: User | null;
  error: string | null;
}

export const authService = {
  /**
   * Sign in with email + password.
   * SUPABASE: const { data, error } = await supabase.auth.signInWithPassword({ email, password })
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    await delay();
    const creds = table.get('credentials');
    const match = creds.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password
    );
    if (!match) return { user: null, error: 'Correo o contraseña incorrectos.' };

    const user = table.get('users').find((u) => u.id === match.userId) ?? null;
    if (!user) return { user: null, error: 'Usuario no encontrado.' };
    if (!user.active) return { user: null, error: 'Tu cuenta está desactivada. Contacta al administrador.' };

    session.set(user.id);
    return { user, error: null };
  },

  /** SUPABASE: await supabase.auth.signOut() */
  async signOut(): Promise<void> {
    await delay(60);
    session.set(null);
  },

  /**
   * Restore the current session.
   * SUPABASE: const { data } = await supabase.auth.getUser()
   */
  getCurrentUser(): User | null {
    const id = session.get();
    if (!id) return null;
    return table.get('users').find((u) => u.id === id) ?? null;
  },
};
