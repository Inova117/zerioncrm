import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Comment, Lead, Task, Temperature, User } from '../types';
import { leadsService } from '../services/leadsService';
import type { NewLeadInput } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
import type { NewTaskInput } from '../services/tasksService';
import { usersService } from '../services/usersService';
import type { NewUserInput } from '../services/usersService';
import { useAuth } from './AuthContext';

interface DataContextValue {
  loading: boolean;
  users: User[];
  leads: Lead[];
  tasks: Task[];
  reload: () => Promise<void>;

  // Leads
  createLead: (input: NewLeadInput) => Promise<Lead>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  moveLead: (id: string, temperature: Temperature) => Promise<void>;
  reorderLeads: (orderedIds: string[]) => Promise<void>;
  removeLead: (id: string) => Promise<void>;

  // Comments
  loadComments: (leadId: string) => Promise<Comment[]>;
  addComment: (leadId: string, body: string) => Promise<void>;
  removeComment: (id: string) => Promise<void>;

  // Tasks
  createTask: (input: NewTaskInput) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;

  // Users (admin)
  createUser: (input: NewUserInput) => Promise<{ error: string | null }>;
  setUserActive: (id: string, active: boolean) => Promise<void>;
  setUserPassword: (id: string, password: string) => Promise<{ error: string | null }>;
  removeUser: (id: string) => Promise<void>;

  userById: (id: string) => User | undefined;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const reload = useCallback(async () => {
    const [u, l, t] = await Promise.all([
      usersService.list(),
      leadsService.list(),
      tasksService.list(),
    ]);
    setUsers(u);
    setLeads(l);
    setTasks(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [user, reload]);

  const authorId = user?.id ?? '';

  const value: DataContextValue = {
    loading,
    users,
    leads,
    tasks,
    reload,

    async createLead(input) {
      const lead = await leadsService.create(input);
      setLeads((prev) => [...prev, lead]);
      return lead;
    },
    async updateLead(id, patch) {
      const updated = await leadsService.update(id, patch);
      if (updated) setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    },
    async moveLead(id, temperature) {
      // optimistic
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, temperature } : l)));
      await leadsService.move(id, temperature, authorId);
    },
    async reorderLeads(orderedIds) {
      await leadsService.reorder(orderedIds);
    },
    async removeLead(id) {
      await leadsService.remove(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    },

    async loadComments(leadId) {
      return leadsService.comments(leadId);
    },
    async addComment(leadId, body) {
      await leadsService.addActivity(leadId, authorId, 'comment', body);
      await leadsService.update(leadId, {});
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, lastContactAt: new Date().toISOString() } : l))
      );
    },
    async removeComment(id) {
      await leadsService.removeComment(id);
    },

    async createTask(input) {
      const task = await tasksService.create(input);
      setTasks((prev) => [task, ...prev]);
    },
    async toggleTask(id) {
      const updated = await tasksService.toggle(id);
      if (updated) setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    },
    async updateTask(id, patch) {
      await tasksService.update(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    async removeTask(id) {
      await tasksService.remove(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },

    async createUser(input) {
      const { user: created, error } = await usersService.create(input);
      if (created) setUsers((prev) => [...prev, created]);
      return { error };
    },
    async setUserActive(id, active) {
      await usersService.setActive(id, active);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active } : u)));
    },
    async setUserPassword(id, password) {
      return usersService.setPassword(id, password);
    },
    async removeUser(id) {
      await usersService.remove(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    },

    userById: (id) => users.find((u) => u.id === id),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
