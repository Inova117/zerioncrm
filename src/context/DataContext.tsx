import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Comment, Contact, Lead, Task, Temperature, User } from '../types';
import { leadsService } from '../services/leadsService';
import type { NewLeadInput, NewContactInput } from '../services/leadsService';
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
  commentCounts: Record<string, number>;
  reload: () => Promise<void>;

  // Leads
  createLead: (input: NewLeadInput) => Promise<Lead>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  moveLead: (id: string, temperature: Temperature) => Promise<void>;
  /** Atomic drag commit: change stage (if needed) + reorder the target column. */
  commitDrag: (leadId: string, toTemperature: Temperature, orderedVisibleIds: string[]) => Promise<void>;
  removeLead: (id: string) => Promise<void>;

  // Comments
  loadComments: (leadId: string) => Promise<Comment[]>;
  addComment: (leadId: string, body: string) => Promise<void>;
  removeComment: (id: string) => Promise<void>;

  // Contacts (stakeholders)
  loadContacts: (leadId: string) => Promise<Contact[]>;
  addContact: (input: NewContactInput) => Promise<void>;
  updateContact: (id: string, patch: Partial<Contact>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;

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
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    const [u, l, t, cc] = await Promise.all([
      usersService.list(),
      leadsService.list(),
      tasksService.list(),
      leadsService.commentCounts(),
    ]);
    setUsers(u);
    setLeads(l);
    setTasks(t);
    setCommentCounts(cc);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [user, reload]);

  const authorId = user?.id ?? '';

  // Memoized so the context value keeps a stable identity between renders that
  // don't change the data — avoids re-render / effect-refire storms in consumers
  // (e.g. modal focus effects). Recomputed only when the underlying data changes. (#15)
  const value = useMemo<DataContextValue>(() => ({
    loading,
    users,
    leads,
    tasks,
    commentCounts,
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
      // optimistic for snappy UI…
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, temperature } : l)));
      // …then apply the authoritative row (also carries meetingAt/lastContactAt the
      // service set), so a later edit can't resend stale fields. (bug #1)
      const updated = await leadsService.move(id, temperature, authorId);
      if (updated) setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    },
    async commitDrag(leadId, toTemperature, orderedVisibleIds) {
      // One atomic operation: stage change (if any) + column reorder, finished
      // with a SINGLE authoritative reload. No two setLeads racing. (bugs #4, #14)
      const lead = leads.find((l) => l.id === leadId);
      if (lead && lead.temperature !== toTemperature) {
        await leadsService.move(leadId, toTemperature, authorId);
      }
      await leadsService.reorderColumn(toTemperature, orderedVisibleIds);
      setLeads(await leadsService.list());
    },
    async removeLead(id) {
      await leadsService.remove(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      // detach tasks that pointed at this lead so they don't dangle (bug #17)
      setTasks((prev) => prev.map((t) => (t.leadId === id ? { ...t, leadId: null } : t)));
    },

    async loadComments(leadId) {
      return leadsService.comments(leadId);
    },
    async addComment(leadId, body) {
      await leadsService.addActivity(leadId, authorId, 'comment', body);
      setCommentCounts((prev) => ({ ...prev, [leadId]: (prev[leadId] ?? 0) + 1 }));
      // persist lastContactAt (not just optimistic) so it survives a reload (bug #13)
      const updated = await leadsService.update(leadId, { lastContactAt: new Date().toISOString() });
      if (updated) setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
    },
    async removeComment(id) {
      await leadsService.removeComment(id);
    },

    async loadContacts(leadId) {
      return leadsService.listContacts(leadId);
    },
    async addContact(input) {
      await leadsService.addContact(input);
    },
    async updateContact(id, patch) {
      await leadsService.updateContact(id, patch);
    },
    async removeContact(id) {
      await leadsService.removeContact(id);
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
      // Reassign this user's leads & tasks to the acting admin so nothing is left
      // orphaned (invalid assignedTo breaks avatars, filters & metrics). (bug #5)
      await usersService.remove(id, authorId);
      await reload();
    },

    userById: (id) => users.find((u) => u.id === id),
  }), [loading, users, leads, tasks, commentCounts, authorId, reload]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
