import { Check, Trash2, Link2, CalendarClock, AlertTriangle, Repeat, Minus, Plus } from 'lucide-react';
import type { Lead, Task, User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { cn, fmtDate, isOverdue } from '../../lib/utils';
import { taskDone, taskProgress, taskPct } from '../../lib/objectives';

interface TaskItemProps {
  task: Task;
  owner?: User;
  lead?: Lead;
  showOwner?: boolean;
  onToggle: (id: string) => void;
  onSetProgress: (id: string, value: number) => void;
  onRemove: (id: string) => void;
}

const cadenceWord = { daily: 'día', weekly: 'semana', monthly: 'mes' } as const;

export function TaskItem({ task, owner, lead, showOwner, onToggle, onSetProgress, onRemove }: TaskItemProps) {
  const done = taskDone(task);
  const hasTarget = task.target > 0;
  const progress = taskProgress(task);
  const pct = taskPct(task);

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-surface-200 bg-white p-3 transition-colors hover:border-surface-300',
        done && 'bg-surface-50'
      )}
    >
      {/* Checkbox — clickable for plain tasks; a done indicator for target objectives */}
      <button
        onClick={() => !hasTarget && onToggle(task.id)}
        disabled={hasTarget}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          done ? 'border-cliente bg-cliente text-white' : 'border-surface-300 hover:border-brand-500',
          hasTarget && 'cursor-default'
        )}
        aria-label={done ? 'Completado' : 'Marcar como hecho'}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-sm font-medium text-surface-800', done && 'text-surface-400 line-through')}>
            {task.title}
          </p>
          {task.recurring && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-600"
              title={`Se reinicia cada ${cadenceWord[task.cadence]}`}
            >
              <Repeat className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        {task.notes && <p className="mt-0.5 text-xs text-surface-400">{task.notes}</p>}

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-surface-400">
          {task.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                isOverdue(task.dueDate, done) && 'font-medium text-caliente'
              )}
            >
              {isOverdue(task.dueDate, done) ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <CalendarClock className="h-3 w-3" />
              )}
              {fmtDate(task.dueDate)}
              {isOverdue(task.dueDate, done) && ' · vencida'}
            </span>
          )}
          {lead && (
            <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-brand-600">
              <Link2 className="h-3 w-3" />
              {lead.company}
            </span>
          )}
        </div>

        {/* Progress objective */}
        {hasTarget && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSetProgress(task.id, Math.max(0, progress - 1))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-surface-300 text-surface-500 hover:bg-surface-100"
                aria-label="Restar"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={0}
                value={progress}
                onChange={(e) => onSetProgress(task.id, Number(e.target.value) || 0)}
                className="input h-6 w-14 px-1.5 py-0 text-center text-xs"
              />
              <span className="text-xs text-surface-400">/ {task.target}</span>
              <button
                onClick={() => onSetProgress(task.id, progress + 1)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-surface-300 text-surface-500 hover:bg-surface-100"
                aria-label="Sumar"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className={cn('ml-auto text-xs font-semibold', done ? 'text-cliente' : 'text-surface-600')}>
                {pct}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-200">
              <div
                className={cn('h-full rounded-full transition-all', done ? 'bg-cliente' : 'bg-brand-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showOwner && owner && <Avatar name={owner.name} color={owner.avatarColor} size="sm" />}
        <button
          onClick={() => onRemove(task.id)}
          className="rounded p-1 text-surface-300 opacity-0 transition-opacity hover:text-caliente group-hover:opacity-100"
          aria-label="Eliminar tarea"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
