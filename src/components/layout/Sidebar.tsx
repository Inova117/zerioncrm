import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Radar,
  KanbanSquare,
  CheckSquare,
  ClipboardList,
  BarChart3,
  PhoneCall,
  Users,
  Map,
  LogOut,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { followUpBucket } from '../../lib/followUp';
import { isRoadmapOwner } from '../../lib/roadmapGate';
import { Avatar } from '../ui/Avatar';
import { roleLabel } from '../../lib/constants';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  ownerOnly?: boolean;
}

const NAV: NavItem[] = [
  // La SALA del Sales Copilot no tiene tab propio: se abre desde el popup del
  // prospecto (botón "Sales Copilot"). Sus MÉTRICAS sí, porque se consultan
  // solas al final del día. /empresas sigue viva por URL, pero fuera del menú.
  { to: '/', label: 'Panel', icon: LayoutDashboard },
  // La vista HOY es el centro de mando del vendedor: solo lo que toca hoy.
  { to: '/hoy', label: 'Hoy', icon: CalendarDays },
  { to: '/lead-finder', label: 'Lead Finder', icon: Radar },
  { to: '/leads', label: 'Prospectos', icon: KanbanSquare },
  { to: '/tareas', label: 'Tareas', icon: CheckSquare },
  { to: '/actividad', label: 'Actividad', icon: ClipboardList },
  { to: '/copilot/metricas', label: 'Llamadas', icon: PhoneCall },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  // Guía Diaria V1: módulo personal del fundador. ownerOnly = solo Martín
  // (admin id 117mgd…); ni empleados ni otros admins lo ven.
  { to: '/roadmap', label: 'Roadmap', icon: Map, ownerOnly: true },
  { to: '/equipo', label: 'Equipo', icon: Users, adminOnly: true },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
  const { leads } = useData();

  // Alerta de follow-up: cuántos seguimientos tiene pendientes el usuario HOY
  // (atrasados + de hoy). Se pinta como badge en el item "Hoy" del menú.
  const followUpCount = useMemo(() => {
    let overdue = 0;
    let today = 0;
    for (const l of leads) {
      const b = followUpBucket(l.nextActionAt);
      if (b === 'overdue') overdue += 1;
      else if (b === 'today') today += 1;
    }
    return { overdue, today, total: overdue + today };
  }, [leads]);

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
          {NAV.filter((n) => (!n.adminOnly || isAdmin) && (!n.ownerOnly || isRoadmapOwner(user))).map(
            ({ to, label, icon: Icon }) => (
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
              {/* Alerta de follow-up: pendientes que tocan hoy */}
              {to === '/hoy' && followUpCount.total > 0 && (
                <span
                  className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                    followUpCount.overdue > 0
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-400 text-white'
                  )}
                  title={
                    followUpCount.overdue > 0
                      ? `${followUpCount.overdue} atrasado${followUpCount.overdue === 1 ? '' : 's'} · ${followUpCount.today} para hoy`
                      : `${followUpCount.today} seguimiento${followUpCount.today === 1 ? '' : 's'} para hoy`
                  }
                >
                  {followUpCount.total}
                </span>
              )}
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
