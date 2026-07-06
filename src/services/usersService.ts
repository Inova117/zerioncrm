import type { User, Role } from '../types';
import { table, delay } from './db';
import { uid, nowISO } from '../lib/utils';
import { AVATAR_COLORS } from '../lib/constants';
import { supabase } from '../lib/supabaseClient';
import { rowToUser } from './mappers';

export interface NewUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UsersService {
  list(): Promise<User[]>;
  create(input: NewUserInput): Promise<{ user: User | null; error: string | null }>;
  setActive(userId: string, active: boolean): Promise<void>;
  setPassword(userId: string, password: string): Promise<{ error: string | null }>;
  remove(userId: string, reassignTo?: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Supabase implementation. Privileged actions (create auth user, change another
// user's password, delete auth user) require the service_role, so they go
// through the `admin-users` Edge Function which verifies the caller is an admin.
// ---------------------------------------------------------------------------
async function invokeAdmin(body: Record<string, unknown>): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase!.functions.invoke('admin-users', { body });
  if (error) {
    // Prefer the function's own JSON error message when present.
    const msg = (data && (data as any).error) || error.message || 'Error del servidor';
    return { data: null, error: msg };
  }
  if (data && (data as any).error) return { data: null, error: (data as any).error };
  return { data, error: null };
}

const supabaseUsersService: UsersService = {
  async list() {
    const { data, error } = await supabase!
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToUser);
  },

  async create(input) {
    if (input.password.length < 6) {
      return { user: null, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }
    const { data, error } = await invokeAdmin({
      action: 'create',
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: input.role,
    });
    if (error) return { user: null, error };
    return { user: data?.user ? rowToUser(data.user) : null, error: null };
  },

  async setActive(userId, active) {
    const { error } = await supabase!.from('profiles').update({ active }).eq('id', userId);
    if (error) throw error;
  },

  async setPassword(userId, password) {
    if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' };
    const { error } = await invokeAdmin({ action: 'set-password', userId, password });
    return { error };
  },

  async remove(userId, reassignTo) {
    // Reassign this user's rows FIRST (single bulk update each) so the FK to
    // profiles isn't violated when the auth user (and its profile) is deleted.
    if (reassignTo) {
      await supabase!.from('leads').update({ assigned_to: reassignTo }).eq('assigned_to', userId);
      await supabase!.from('tasks').update({ assigned_to: reassignTo }).eq('assigned_to', userId);
    }
    const { error } = await invokeAdmin({ action: 'delete', userId });
    if (error) throw new Error(error);
  },
};

// ---------------------------------------------------------------------------
// Mock implementation (local dev)
// ---------------------------------------------------------------------------
const mockUsersService: UsersService = {
  async list() {
    await delay();
    return [...table.get('users')].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async create(input) {
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
    table.set('credentials', [...table.get('credentials'), { userId: user.id, email, password: input.password }]);
    return { user, error: null };
  },

  async setActive(userId, active) {
    await delay();
    table.set('users', table.get('users').map((u) => (u.id === userId ? { ...u, active } : u)));
  },

  async setPassword(userId, password) {
    await delay();
    if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' };
    table.set(
      'credentials',
      table.get('credentials').map((c) => (c.userId === userId ? { ...c, password } : c))
    );
    return { error: null };
  },

  async remove(userId, reassignTo) {
    await delay();
    table.set('users', table.get('users').filter((u) => u.id !== userId));
    table.set('credentials', table.get('credentials').filter((c) => c.userId !== userId));
    if (reassignTo) {
      table.set('leads', table.get('leads').map((l) => (l.assignedTo === userId ? { ...l, assignedTo: reassignTo } : l)));
      table.set('tasks', table.get('tasks').map((t) => (t.assignedTo === userId ? { ...t, assignedTo: reassignTo } : t)));
    }
  },
};

export const usersService: UsersService = supabase ? supabaseUsersService : mockUsersService;
