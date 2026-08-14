import { useMemo, useState } from 'react';
import {
  UserPlus,
  KeyRound,
  Power,
  Trash2,
  ShieldCheck,
  Users as UsersIcon,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { UserFormModal } from '../components/team/UserFormModal';
import { EmployeeProfileModal } from '../components/team/EmployeeProfileModal';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { employeeStats } from '../services/metricsService';
import { roleLabel } from '../lib/constants';
import { cn, fmtDate } from '../lib/utils';
import type { User } from '../types';

export function TeamPage() {
  const { user } = useAuth();
  const { loading, users, leads, tasks, createUser, setUserActive, setUserPassword, removeUser } =
    useData();

  const [formOpen, setFormOpen] = useState(false);
  const [profileFor, setProfileFor] = useState<User | null>(null);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPass, setNewPass] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const stats = useMemo(() => employeeStats(users, leads, tasks), [users, leads, tasks]);
  const statsById = useMemo(() => new Map(stats.map((s) => [s.user.id, s])), [stats]);
  const admins = users.filter((u) => u.role === 'admin');
  const employees = users.filter((u) => u.role === 'employee');

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    const { error } = await setUserPassword(resetFor.id, newPass);
    if (error) setResetMsg(error);
    else {
      setResetMsg('Contraseña actualizada ✓');
      setTimeout(() => {
        setResetFor(null);
        setNewPass('');
        setResetMsg(null);
      }, 900);
    }
  }

  if (!user) return null;

  const renderCard = (u: User) => {
    const s = statsById.get(u.id);
    const isSelf = u.id === user.id;
    return (
      <div key={u.id} className={cn('card p-4', !u.active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setProfileFor(u)}
            className="-m-1 flex items-start gap-3 rounded-lg p-1 text-left transition-colors hover:bg-surface-50"
            title="Ver perfil, tareas y prospectos"
          >
            <Avatar name={u.name} color={u.avatarColor} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-surface-900">{u.name}</p>
                {u.role === 'admin' && (
                  <span className="badge bg-brand-50 text-brand-600">
                    <ShieldCheck className="h-3 w-3" /> Admin
                  </span>
                )}
                {!u.active && <span className="badge bg-surface-100 text-surface-500">Inactivo</span>}
              </div>
              <p className="truncate text-sm text-surface-500">{u.email}</p>
              <p className="mt-0.5 text-xs text-surface-400">
                {roleLabel(u.role)} · desde {fmtDate(u.createdAt)}
              </p>
            </div>
          </button>
        </div>

        {/* Stats for employees */}
        {u.role === 'employee' && s && (
          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-surface-100 pt-3 text-center">
            <div>
              <p className="text-base font-semibold text-surface-800">{s.contacted}</p>
              <p className="text-[10px] uppercase tracking-wide text-surface-400">Contact.</p>
            </div>
            <div>
              <p className="text-base font-semibold text-red-600">{s.negociando}</p>
              <p className="text-[10px] uppercase tracking-wide text-surface-400">Negociando</p>
            </div>
            <div>
              <p className="text-base font-semibold text-emerald-600">{s.clientes}</p>
              <p className="text-[10px] uppercase tracking-wide text-surface-400">Clientes</p>
            </div>
            <div>
              <p className="text-base font-semibold text-brand-600">{s.conversionRate}%</p>
              <p className="text-[10px] uppercase tracking-wide text-surface-400">Conv.</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-surface-100 pt-3">
          <button
            className="btn-ghost px-2 py-1.5 text-xs"
            onClick={() => {
              setResetFor(u);
              setNewPass('');
              setResetMsg(null);
            }}
          >
            <KeyRound className="h-3.5 w-3.5" /> Contraseña
          </button>
          {!isSelf && (
            <button
              className="btn-ghost px-2 py-1.5 text-xs"
              onClick={() => setUserActive(u.id, !u.active)}
            >
              <Power className="h-3.5 w-3.5" />
              {u.active ? 'Desactivar' : 'Activar'}
            </button>
          )}
          {!isSelf &&
            (confirmDelete === u.id ? (
              <button
                className="btn-ghost px-2 py-1.5 text-xs text-caliente"
                onClick={async () => {
                  await removeUser(u.id);
                  setConfirmDelete(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Confirmar
              </button>
            ) : (
              <button
                className="btn-ghost ml-auto px-2 py-1.5 text-xs text-surface-400 hover:text-caliente"
                onClick={() => setConfirmDelete(u.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ))}
        </div>
      </div>
    );
  };

  return (
    <AppLayout
      title="Equipo"
      subtitle="Crea y administra las cuentas de tu staff."
      actions={
        <button className="btn-primary" onClick={() => setFormOpen(true)}>
          <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo staff</span>
        </button>
      }
    >
      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
              Administradores
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{admins.map(renderCard)}</div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
              Staff ({employees.length})
            </h2>
            {employees.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="h-10 w-10" />}
                title="Aún no hay staff"
                description="Crea la primera cuenta para tu equipo de outreach."
                action={
                  <button className="btn-primary" onClick={() => setFormOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Nuevo staff
                  </button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {employees.map(renderCard)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* key remounts the form on each open → fresh fields + new temp password (bug #2) */}
      <UserFormModal
        key={formOpen ? 'user-form-open' : 'user-form-closed'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={createUser}
      />

      {/* Employee profile — their tasks & leads */}
      <EmployeeProfileModal
        user={profileFor}
        open={Boolean(profileFor)}
        onClose={() => setProfileFor(null)}
        tasks={tasks}
        leads={leads}
      />

      {/* Reset password */}
      <Modal
        open={Boolean(resetFor)}
        onClose={() => setResetFor(null)}
        title="Cambiar contraseña"
        subtitle={resetFor?.name}
        size="sm"
      >
        <form onSubmit={doReset} className="space-y-4">
          <div>
            <label className="label">Nueva contraseña</label>
            <input
              className="input font-mono"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="mínimo 6 caracteres"
              minLength={6}
              required
              autoFocus
            />
          </div>
          {resetMsg && (
            <p
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                resetMsg.includes('✓') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              )}
            >
              {resetMsg}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setResetFor(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
