import { CheckSquare, Square, KanbanSquare, ListTodo } from 'lucide-react';
import type { Lead, Task, User } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { TemperatureBadge } from '../ui/TemperatureBadge';
import { EmptyState } from '../ui/misc';
import { CADENCES, roleLabel } from '../../lib/constants';
import { cn, fmtDate, fmtMoney } from '../../lib/utils';

interface EmployeeProfileModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  leads: Lead[];
}

export function EmployeeProfileModal({ user, open, onClose, tasks, leads }: EmployeeProfileModalProps) {
  if (!user) return null;

  const myTasks = tasks.filter((t) => t.assignedTo === user.id);
  const myLeads = leads.filter((l) => l.assignedTo === user.id);
  const doneCount = myTasks.filter((t) => t.done).length;

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
                          {t.done ? (
                            <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-cliente" />
                          ) : (
                            <Square className="mt-0.5 h-4 w-4 shrink-0 text-surface-300" />
                          )}
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'text-sm text-surface-700',
                                t.done && 'text-surface-400 line-through'
                              )}
                            >
                              {t.title}
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
              {myLeads.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-surface-200 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-surface-800">{l.company}</p>
                    <p className="truncate text-xs text-surface-400">
                      {l.contactName || '—'}
                      {l.value > 0 ? ` · ${fmtMoney(l.value)}` : ''}
                    </p>
                  </div>
                  <TemperatureBadge temperature={l.temperature} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
