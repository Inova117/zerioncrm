import { useState } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Where the user was headed before being bounced to /login — preserve the full
  // location (path + query + hash), not just the pathname. (bugs #14, #22)
  const fromLoc = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)
    ?.from;
  const from = fromLoc
    ? `${fromLoc.pathname ?? '/'}${fromLoc.search ?? ''}${fromLoc.hash ?? ''}`
    : '/';

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
    else navigate(from, { replace: true });
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden overflow-hidden bg-surface-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60% 50% at 20% 10%, rgba(99,102,241,.35), transparent), radial-gradient(50% 50% at 90% 90%, rgba(139,92,246,.30), transparent)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-base font-bold text-white">
            Z
          </div>
          <span className="text-lg font-semibold text-white">Zerion CRM</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            El outreach de tu equipo, bajo control.
          </h2>
          <p className="mt-4 text-surface-300">
            Sigue a quién contactan, clasifica prospectos de frío a caliente y mide cuántos
            terminan en reunión. Simple, claro y sin fricción.
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-sm text-surface-400">
          <ShieldCheck className="h-4 w-4" />
          Acceso solo por invitación · las cuentas las crea el administrador
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">
              Z
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-surface-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-surface-500">
            Entra con la cuenta que te asignó el administrador.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Correo
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input pl-9"
                  placeholder="tu@zerionstudio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div className="mt-8 rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-xs text-surface-500">
            <p className="font-medium text-surface-600">Cuentas de demostración</p>
            <p className="mt-1">
              Admin: <span className="font-mono">admin@zerionstudio.com</span> ·{' '}
              <span className="font-mono">zerion2026</span>
            </p>
            <p>
              Staff: <span className="font-mono">lucia@zerionstudio.com</span> ·{' '}
              <span className="font-mono">lucia123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
