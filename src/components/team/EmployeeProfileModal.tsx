import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Square, KanbanSquare, ListTodo, BellRing, ClipboardList, Loader2 } from 'lucide-react';
import type { Lead, Task, User, DailyActivity } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { TemperatureBadge } from '../ui/TemperatureBadge';
import { EmptyState } from '../ui/misc';
import { CADENCES, roleLabel } from '../../lib/constants';
import { cn, fmtDate, fmtMoney, fmtDateTime } from '../../lib/utils';
import { taskDone } from '../../lib/objectives';
import { followUpBucket, touchInfo } from '../../lib/followUp';
import { dailyActivityService } from '../../services/dailyActivityService';

interface EmployeeProfileModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  leads: Lead[];
}

export function EmployeeProfileModal({ user, open, onClose, tasks, leads }: EmployeeProfileModalProps) {
  // Check-ins diarios del empleado (lo que registró en el tab Actividad).
  const [activity, setActivity] = useState<DailyActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!user || !open) {
      setActivity([]);
      return;
    }
    setActivityLoading(true);
    dailyActivityService
      .listFor(user.id)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [user, open]);

  if (!user) return null;

  const myTasks = tasks.filter((t) => t.assignedTo === user.id);
  const myLeads = leads.filter((l) => l.assignedTo === user.id);
  const doneCount = myTasks.filter((t) => taskDone(t)).length;

  // Últimos 7 días con registro (más reciente primero).
  const recentActivity = [...activity]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 7);

  return (
    <Modal open={open} onClose={onClose} size="lg">
      {/* Header */}
      <div className="-mt-1 mb-5 flex items-center gap-3">
        <Avatar name={user.name} color={user.avatarColor} size="lg" />
        <div>
          <h2 className="text-lg font-semibold text-surface-900">{user.name}</h2>
          <p className="text-sm text-surface-500">{user.email}</p>
          <p className="text-xs text-surface-400">
            {roleLabel(user.role)} · {myLeads.length} prospectos · {myTasks.length} tareas
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasks */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-800">
            <ListTodo className="h-4 w-4 text-surface-400" />
            Tareas asignadas
            <span className="text-xs font-normal text-surface-400">
              ({doneCount}/{myTasks.length} hechas)
            </span>
          </h3>
          {myTasks.length === 0 ? (
            <EmptyState title="Sin tareas" description="Esta persona no tiene tareas asignadas." />
          ) : (
            <div className="space-y-3">
              {CADENCES.map((c) => {
                const list = myTasks.filter((t) => t.cadence === c.key);
                if (list.length === 0) return null;
                return (
                  <div key={c.key}>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-surface-400">
                      {c.label}
                    </p>
                    <div className="space-y-1.5">
                      {list.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-start gap-2 rounded-lg border border-surface-200 px-2.5 py-2"
                        >
                          {taskDone(t) ? (
                            <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-cliente" />
                          ) : (
                            <Square className="mt-0.5 h-4 w-4 shrink-0 text-surface-300" />
                          )}
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'text-sm text-surface-700',
                                taskDone(t) && 'text-surface-400 line-through'
                              )}
                            >
                              {t.title}
                              {t.target > 0 && (
                                <span className="ml-1 text-[11px] font-normal text-surface-400">
                                  · {t.progress}/{t.target}
                                </span>
                              )}
                            </p>
                            {t.dueDate && (
                              <p className="text-[11px] text-surface-400">Vence {fmtDate(t.dueDate)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Leads */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-800">
            <KanbanSquare className="h-4 w-4 text-surface-400" />
            Prospectos asignados
          </h3>
          {myLeads.length === 0 ? (
            <EmptyState title="Sin prospectos" description="Esta persona no tiene prospectos asignados." />
          ) : (
            <div className="space-y-1.5">
              {myLeads.map((l) => {
                const t = touchInfo(l);
                const b = followUpBucket(l.nextActionAt);
                const closed = l.temperature === 'cliente' || l.temperature === 'perdido';
                return (
                  <Link
                    key={l.id}
                    to={`/leads?lead=${l.id}`}
                    title="Abrir el prospecto"
                    className="flex items-center justify-between gap-2 rounded-lg border border-surface-200 px-2.5 py-2 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-surface-800">{l.company}</p>
                      <p className="truncate text-xs text-surface-400">
                        {l.contactName || '—'}
                        {l.value > 0 ? ` · ${fmtMoney(l.value)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {t && l.nextActionAt && !closed && (
                        <span
                          className={cn(
                            'badge text-[10px]',
                            b === 'overdue'
                              ? 'bg-red-50 text-red-600'
                              : b === 'today'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-surface-100 text-surface-500'
                          )}
                          title={`Siguiente toque: ${fmtDateTime(l.nextActionAt)}`}
                        >
                          <BellRing className="h-2.5 w-2.5" />
                          {t.touch}/{t.total > 0 ? t.total : '∞'}
                        </span>
                      )}
                      <TemperatureBadge temperature={l.temperature} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Check-ins recientes: lo que el empleado registró en su Actividad */}
      <section className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-800">
          <ClipboardList className="h-4 w-4 text-surface-400" />
          Actividad reciente (check-ins)
          <span className="text-xs font-normal text-surface-400">últimos 7 días con registro</span>
        </h3>
        {activityLoading ? (
          <div className="flex h-20 items-center justify-center text-surface-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : recentActivity.length === 0 ? (
          <EmptyState
            title="Sin check-ins aún"
            description="Cuando registre su día en el tab Actividad, aparecerá aquí."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
                  <th className="pb-2 pr-2">Día</th>
                  <th className="pb-2 pr-2 text-center">Llamadas</th>
                  <th className="pb-2 pr-2 text-center">Contactos</th>
                  <th className="pb-2 pr-2 text-center">Demos</th>
                  <th className="pb-2 text-center">Cierres</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((r) => (
                  <tr
                    key={r.day}
                    className="border-t border-surface-100"
                    title={r.notes ? `📝 ${r.notes}` : undefined}
                  >
                    <td className="py-1.5 pr-2 font-medium text-surface-700">{fmtDate(r.day, 'd MMM')}</td>
                    <td className="py-1.5 pr-2 text-center text-surface-700">{r.calls}</td>
                    <td className="py-1.5 pr-2 text-center text-surface-700">{r.contacts}</td>
                    <td className="py-1.5 pr-2 text-center text-surface-700">{r.demos}</td>
                    <td className="py-1.5 text-center font-semibold text-emerald-700">{r.closes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Modal>
  );
}
