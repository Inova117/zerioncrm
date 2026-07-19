import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Radar,
  KanbanSquare,
  CheckSquare,
  BarChart3,
  PhoneCall,
  Users,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { roleLabel } from '../../lib/constants';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  // La SALA del Sales Copilot no tiene tab propio: se abre desde el popup del
  // prospecto (botón "Sales Copilot"). Sus MÉTRICAS sí, porque se consultan
  // solas al final del día. /empresas sigue viva por URL, pero fuera del menú.
  { to: '/', label: 'Panel', icon: LayoutDashboard },
  { to: '/lead-finder', label: 'Lead Finder', icon: Radar },
  { to: '/leads', label: 'Prospectos', icon: KanbanSquare },
  { to: '/tareas', label: 'Tareas', icon: CheckSquare },
  { to: '/copilot/metricas', label: 'Llamadas', icon: PhoneCall },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/equipo', label: 'Equipo', icon: Users, adminOnly: true },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isAdmin, signOut } = useAuth();

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-surface-900/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-surface-200 bg-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
              Z
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-surface-900">Zerion CRM</p>
              <p className="text-[11px] text-surface-400">ZerionStudio</p>
            </div>
          </div>
          <button className="btn-ghost rounded-lg p-1.5 lg:hidden" onClick={onClose} aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-surface-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={user?.name ?? ''} color={user?.avatarColor} size="md" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-surface-800">{user?.name}</p>
              <p className="truncate text-xs text-surface-400">{user && roleLabel(user.role)}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="btn-ghost rounded-lg p-2 text-surface-400 hover:text-caliente"
              title="Cerrar sesión"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
