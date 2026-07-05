import type { User, Credential, Role } from '../types';
import { table, delay } from './db';
import { uid, nowISO } from '../lib/utils';
import { AVATAR_COLORS } from '../lib/constants';

export interface NewUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export const usersService = {
  /** SUPABASE: supabase.from('profiles').select('*').order('created_at') */
  async list(): Promise<User[]> {
    await delay();
    return [...table.get('users')].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /**
   * Admin creates an employee account (users cannot self-register).
   * SUPABASE: this becomes an Edge Function / server call using the service_role
   *   key: supabase.auth.admin.createUser({ email, password, email_confirm: true })
   *   followed by an insert into `profiles`. The anon client can NOT do this,
   *   which is exactly the "only the admin creates accounts" guarantee.
   */
  async create(input: NewUserInput): Promise<{ user: User | null; error: string | null }> {
    await delay();
    const email = input.email.trim().toLowerCase();
    const users = table.get('users');
    if (users.some((u) => u.email.toLowerCase() === email)) {
      return { user: null, error: 'Ya existe una cuenta con ese correo.' };
    }
    if (input.password.length < 6) {
      return { user: null, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    const user: User = {
      id: uid('usr-'),
      email,
      name: input.name.trim(),
      role: input.role,
      avatarColor: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
      active: true,
      createdAt: nowISO(),
    };
    table.set('users', [...users, user]);

    const cred: Credential = { userId: user.id, email, password: input.password };
    table.set('credentials', [...table.get('credentials'), cred]);

    return { user, error: null };
  },

  /** Toggle active/inactive. SUPABASE: update profiles set active = :v where id = :id */
  async setActive(userId: string, active: boolean): Promise<void> {
    await delay();
    table.set(
      'users',
      table.get('users').map((u) => (u.id === userId ? { ...u, active } : u))
    );
  },

  /** Change a user's password. SUPABASE: supabase.auth.admin.updateUserById(id, { password }) */
  async setPassword(userId: string, password: string): Promise<{ error: string | null }> {
    await delay();
    if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' };
    table.set(
      'credentials',
      table.get('credentials').map((c) => (c.userId === userId ? { ...c, password } : c))
    );
    return { error: null };
  },

  /**
   * Delete an employee (and their credential). Their leads & tasks are reassigned
   * to `reassignTo` (the acting admin) so no row is left with a dangling
   * assignedTo. Comments keep their original authorId (history is preserved; the
   * UI renders a deleted author gracefully).
   * SUPABASE: declare FKs with a deliberate ON DELETE policy (SET NULL / RESTRICT)
   *   and do the reassignment in a transaction / Edge Function.
   */
  async remove(userId: string, reassignTo?: string): Promise<void> {
    await delay();
    table.set('users', table.get('users').filter((u) => u.id !== userId));
    table.set('credentials', table.get('credentials').filter((c) => c.userId !== userId));
    if (reassignTo) {
      table.set(
        'leads',
        table.get('leads').map((l) => (l.assignedTo === userId ? { ...l, assignedTo: reassignTo } : l))
      );
      table.set(
        'tasks',
        table.get('tasks').map((t) => (t.assignedTo === userId ? { ...t, assignedTo: reassignTo } : t))
      );
    }
  },
};
