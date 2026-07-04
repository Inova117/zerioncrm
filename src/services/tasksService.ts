import type { Task, TaskCadence } from '../types';
import { table, delay } from './db';
import { uid, nowISO } from '../lib/utils';

export interface NewTaskInput {
  title: string;
  notes: string;
  cadence: TaskCadence;
  assignedTo: string;
  leadId: string | null;
  dueDate: string | null;
}

export const tasksService = {
  /** SUPABASE: supabase.from('tasks').select('*').order('created_at', { ascending: false }) */
  async list(): Promise<Task[]> {
    await delay();
    return [...table.get('tasks')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(input: NewTaskInput): Promise<Task> {
    await delay();
    const task: Task = {
      ...input,
      id: uid('t-'),
      done: false,
      createdAt: nowISO(),
      completedAt: null,
    };
    table.set('tasks', [...table.get('tasks'), task]);
    return task;
  },

  async toggle(id: string): Promise<Task | null> {
    await delay(60);
    let updated: Task | null = null;
    table.set(
      'tasks',
      table.get('tasks').map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        updated = { ...t, done, completedAt: done ? nowISO() : null };
        return updated;
      })
    );
    return updated;
  },

  async update(id: string, patch: Partial<Task>): Promise<void> {
    await delay();
    table.set(
      'tasks',
      table.get('tasks').map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  },

  async remove(id: string): Promise<void> {
    await delay();
    table.set('tasks', table.get('tasks').filter((t) => t.id !== id));
  },
};
