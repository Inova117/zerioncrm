import type { Task, TaskCadence } from '../types';
import { table, delay } from './db';
import { uid, nowISO } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { rowToTask, taskToRow } from './mappers';

export interface NewTaskInput {
  title: string;
  notes: string;
  cadence: TaskCadence;
  assignedTo: string;
  leadId: string | null;
  dueDate: string | null;
  recurring: boolean;
  target: number;
}

export interface TasksService {
  list(): Promise<Task[]>;
  create(input: NewTaskInput): Promise<Task>;
  toggle(id: string): Promise<Task | null>;
  update(id: string, patch: Partial<Task>): Promise<void>;
  remove(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------
const supabaseTasksService: TasksService = {
  async list() {
    const { data, error } = await supabase!
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToTask);
  },

  async create(input) {
    const { data, error } = await supabase!
      .from('tasks')
      .insert({ ...taskToRow(input), done: false })
      .select()
      .single();
    if (error) throw error;
    return rowToTask(data);
  },

  async toggle(id) {
    const { data: cur } = await supabase!.from('tasks').select('done').eq('id', id).single();
    if (!cur) return null;
    const done = !cur.done;
    const { data, error } = await supabase!
      .from('tasks')
      .update({ done, completed_at: done ? nowISO() : null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data ? rowToTask(data) : null;
  },

  async update(id, patch) {
    const { error } = await supabase!.from('tasks').update(taskToRow(patch)).eq('id', id);
    if (error) throw error;
  },

  async remove(id) {
    const { error } = await supabase!.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---------------------------------------------------------------------------
// Mock implementation (local dev)
// ---------------------------------------------------------------------------
const mockTasksService: TasksService = {
  async list() {
    await delay();
    return [...table.get('tasks')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(input) {
    await delay();
    const task: Task = {
      ...input,
      id: uid('t-'),
      done: false,
      createdAt: nowISO(),
      completedAt: null,
      progress: 0,
      periodKey: null,
    };
    table.set('tasks', [...table.get('tasks'), task]);
    return task;
  },

  async toggle(id) {
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

  async update(id, patch) {
    await delay();
    table.set('tasks', table.get('tasks').map((t) => (t.id === id ? { ...t, ...patch } : t)));
  },

  async remove(id) {
    await delay();
    table.set('tasks', table.get('tasks').filter((t) => t.id !== id));
  },
};

export const tasksService: TasksService = supabase ? supabaseTasksService : mockTasksService;
