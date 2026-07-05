import { Check, Trash2, Link2, CalendarClock, AlertTriangle } from 'lucide-react';
import type { Lead, Task, User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { cn, fmtDate, isOverdue } from '../../lib/utils';

interface TaskItemProps {
  task: Task;
  owner?: User;
  lead?: Lead;
  showOwner?: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function TaskItem({ task, owner, lead, showOwner, onToggle, onRemove }: TaskItemProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-surface-200 bg-white p-3 transition-colors hover:border-surface-300',
        task.done && 'bg-surface-50'
      )}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          task.done
            ? 'border-cliente bg-cliente text-white'
            : 'border-surface-300 hover:border-brand-500'
        )}
        aria-label={task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
      >
        {task.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium text-surface-800',
            task.done && 'text-surface-400 line-through'
          )}
        >
          {task.title}
        </p>
        {task.notes && <p className="mt-0.5 text-xs text-surface-400">{task.notes}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-surface-400">
          {task.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                isOverdue(task.dueDate, task.done) && 'font-medium text-caliente'
              )}
            >
              {isOverdue(task.dueDate, task.done) ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <CalendarClock className="h-3 w-3" />
              )}
              {fmtDate(task.dueDate)}
              {isOverdue(task.dueDate, task.done) && ' · vencida'}
            </span>
          )}
          {lead && (
            <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-brand-600">
              <Link2 className="h-3 w-3" />
              {lead.company}
            </span>
          )}
        </div>
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
