import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { authService } from '../services/authService';
import { ensureSeeded } from '../services/db';
import { USE_SUPABASE } from '../lib/supabaseClient';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>; // returns error msg or null
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!USE_SUPABASE) ensureSeeded(); // only bootstrap the local mock, never in prod
    let active = true;
    authService
      .getCurrentUser()
      .then((u) => {
        if (active) setUser(u);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // React to logout / token refresh / deactivation from anywhere.
    const unsubscribe = authService.onAuthChange((u) => {
      if (active) setUser(u);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      async signIn(email, password) {
        const { user: u, error } = await authService.signIn(email, password);
        if (u) setUser(u);
        return error;
      },
      async signOut() {
        await authService.signOut();
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
