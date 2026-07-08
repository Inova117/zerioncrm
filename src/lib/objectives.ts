import { format } from 'date-fns';
import type { Task, TaskCadence } from '../types';

// ============================================================================
// Recurring objectives — progress is scoped to a period key. When the current
// period differs from the stored one, progress/done read as reset (0 / false),
// so daily/weekly/monthly objectives "refresh" automatically with no cron.
// ============================================================================

/** The key for the current (or given) period of a cadence. */
export function currentPeriodKey(cadence: TaskCadence, d: Date = new Date()): string {
  if (cadence === 'daily') return format(d, 'yyyy-MM-dd');
  if (cadence === 'weekly') return format(d, "RRRR-'W'II"); // ISO week-year + week
  return format(d, 'yyyy-MM');
}

/** Does the task's stored progress belong to the current period? */
export function isCurrentPeriod(task: Task): boolean {
  if (!task.recurring) return true; // one-off tasks aren't period-scoped
  return task.periodKey === currentPeriodKey(task.cadence);
}

/** Effective progress this period (0 if a recurring objective rolled over). */
export function taskProgress(task: Task): number {
  return task.recurring && !isCurrentPeriod(task) ? 0 : task.progress;
}

/** Effective done state this period. Target-based objectives are done at 100%. */
export function taskDone(task: Task): boolean {
  if (task.recurring && !isCurrentPeriod(task)) return false;
  if (task.target > 0) return taskProgress(task) >= task.target;
  return task.done;
}

/** Completion percentage (0–100). */
export function taskPct(task: Task): number {
  if (task.target <= 0) return taskDone(task) ? 100 : 0;
  return Math.min(100, Math.round((taskProgress(task) / task.target) * 100));
}
