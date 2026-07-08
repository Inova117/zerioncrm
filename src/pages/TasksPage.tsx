import { useMemo, useState } from 'react';
import { Plus, CheckSquare } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { TaskItem } from '../components/tasks/TaskItem';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { CADENCES } from '../lib/constants';
import type { TaskCadence } from '../types';
import { cn, pct, taskIsCurrent } from '../lib/utils';
import { taskDone } from '../lib/objectives';

export function TasksPage() {
  const { user, isAdmin } = useAuth();
  const { loading, tasks, leads, users, createTask, toggleTask, setTaskProgress, removeTask } = useData();

  const [ownerFilter, setOwnerFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [formCadence, setFormCadence] = useState<TaskCadence>('daily');

  const employees = useMemo(() => users.filter((u) => u.role === 'employee'), [users]);
  // Only active employees can be assigned (deactivated ones can't log in) (#15);
  // if there are none, fall back to the admin so nothing is assigned silently (#19).
  const activeEmployees = useMemo(() => employees.filter((u) => u.active), [employees]);
  const assignableEmployees = useMemo(
    () => (activeEmployees.length ? activeEmployees : user ? [user] : []),
    [activeEmployees, user]
  );
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const visibleTasks = useMemo(() => {
    let list = isAdmin ? tasks : tasks.filter((t) => t.assignedTo === user?.id);
    if (isAdmin && ownerFilter !== 'all') list = list.filter((t) => t.assignedTo === ownerFilter);
    return list;
  }, [tasks, isAdmin, user, ownerFilter]);

  function openForm(cadence: TaskCadence) {
    setFormCadence(cadence);
    setFormOpen(true);
  }

  if (!user) return null;

  return (
    <AppLayout
      title="Tareas"
      subtitle="Objetivos de outreach diarios, semanales y mensuales."
      actions={
        <button className="btn-primary" onClick={() => openForm('daily')}>
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva tarea</span>
        </button>
      }
    >
      {isAdmin && (
        <div className="mb-4 flex items-center gap-2">
          <select
            className="input w-auto"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="all">Todo el equipo</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {CADENCES.map((c) => {
            // Recurring objectives always show (they auto-reset each period);
            // one-off dated tasks use the cadence window. (objetivos + bugs #1/#4)
            const list = visibleTasks
              .filter((t) => t.cadence === c.key && (t.recurring || taskIsCurrent(t)))
              .sort((a, b) => Number(taskDone(a)) - Number(taskDone(b)));
            const done = list.filter((t) => taskDone(t)).length;
            const progress = pct(done, list.length);
            return (
              <section key={c.key} className="flex flex-col">
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-surface-800">{c.label}</h2>
                    <span className="text-xs font-medium text-surface-400">
                      {done}/{list.length}
                    </span>
                  </div>
                  <p className="text-xs text-surface-400">{c.hint}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        progress === 100 ? 'bg-cliente' : 'bg-brand-500'
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {list.length === 0 ? (
                    <EmptyState title="Sin tareas" description={`No hay tareas ${c.label.toLowerCase()}.`} />
                  ) : (
                    list.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        owner={usersById.get(task.assignedTo)}
                        lead={task.leadId ? leadsById.get(task.leadId) : undefined}
                        showOwner={isAdmin}
                        onToggle={toggleTask}
                        onSetProgress={setTaskProgress}
                        onRemove={removeTask}
                      />
                    ))
                  )}
                  <button
                    onClick={() => openForm(c.key)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-300 py-2.5 text-xs font-medium text-surface-400 transition-colors hover:border-brand-400 hover:text-brand-600"
                  >
                    <Plus className="h-3.5 w-3.5" /> Añadir tarea {c.label.toLowerCase()}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {loading || visibleTasks.length > 0 ? null : (
        <div className="mt-6">
          <EmptyState
            icon={<CheckSquare className="h-10 w-10" />}
            title="Aún no hay tareas"
            description="Crea objetivos de outreach para ti o tu equipo."
          />
        </div>
      )}

      <TaskFormModal
        key={`${formOpen}-${formCadence}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        employees={assignableEmployees}
        leads={leads}
        currentUserId={user.id}
        isAdmin={isAdmin}
        defaultCadence={formCadence}
        onSubmit={createTask}
      />
    </AppLayout>
  );
}
