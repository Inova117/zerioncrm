import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Comment, Contact, Lead, Task, Temperature, User } from '../types';
import { leadsService } from '../services/leadsService';
import type { NewLeadInput, NewContactInput } from '../services/leadsService';
import { notifyMetaStageChange } from '../services/metaCapiService';
import { stageFollowUpPatch } from '../lib/followUp';
import { tasksService } from '../services/tasksService';
import type { NewTaskInput } from '../services/tasksService';
import { usersService } from '../services/usersService';
import type { NewUserInput } from '../services/usersService';
import { currentPeriodKey } from '../lib/objectives';
import { useAuth } from './AuthContext';

interface DataContextValue {
  loading: boolean;
  users: User[];
  /** Los leads del usuario ACTUAL (assignedTo = auth uid) — el libro de
   *  negocio operativo: Prospectos, Copilot, empresas. Sin cruce: cada quien
   *  llama SOLO a sus prospectos. */
  leads: Lead[];
  /** TODOS los leads del equipo (sin filtro) — para analítica/supervisión
   *  (Panel, Reportes, carga por miembro, dedupe del Lead Finder). */
  allLeads: Lead[];
  tasks: Task[];
  contacts: Contact[];
  commentCounts: Record<string, number>;
  reload: () => Promise<void>;

  // Leads
  createLead: (input: NewLeadInput) => Promise<Lead>;
  /** Bulk import: create many, one reload at the end, returns {ok, failed}. */
  importLeads: (inputs: NewLeadInput[]) => Promise<{ ok: number; failed: number }>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  moveLead: (id: string, temperature: Temperature) => Promise<void>;
  /** Atomic drag commit: change stage (if needed) + reorder the target column. */
  commitDrag: (leadId: string, toTemperature: Temperature, orderedVisibleIds: string[]) => Promise<void>;
  removeLead: (id: string) => Promise<void>;

  // Comments
  loadComments: (leadId: string) => Promise<Comment[]>;
  addComment: (leadId: string, body: string) => Promise<void>;
  removeComment: (id: string) => Promise<void>;

  // Contacts (stakeholders) — held in global state (contacts above)
  addContact: (input: NewContactInput) => Promise<void>;
  updateContact: (id: string, patch: Partial<Contact>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;

  // Tasks
  createTask: (input: NewTaskInput) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  /** Set a target-based objective's progress for the current period. */
  setTaskProgress: (id: string, value: number) => Promise<void>;
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
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    // allSettled so one failing table doesn't wipe the others' state. (#11)
    const [u, l, t, ct, cc] = await Promise.allSettled([
      usersService.list(),
      leadsService.list(),
      tasksService.list(),
      leadsService.allContacts(),
      leadsService.commentCounts(),
    ]);
    if (u.status === 'fulfilled') setUsers(u.value);
    if (l.status === 'fulfilled') setAllLeads(l.value);
    if (t.status === 'fulfilled') setTasks(t.value);
    if (ct.status === 'fulfilled') setContacts(ct.value);
    if (cc.status === 'fulfilled') setCommentCounts(cc.value);
    const failed = [u, l, t, ct, cc].filter((r) => r.status === 'rejected');
    if (failed.length) console.error('[reload] fuentes con error:', failed.length);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [user, reload]);

  // Refresco automático: cada 60s (solo con la pestaña visible) y al volver a
  // la pestaña. Así el admin ve al día lo que hace el equipo sin recargar.
  // Guard de concurrencia: si un reload ya está en vuelo, no se dispara otro.
  const reloadingRef = useRef(false);
  const reloadOnce = useCallback(async () => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    try {
      await reload();
    } finally {
      reloadingRef.current = false;
    }
  }, [reload]);

  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reloadOnce();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void reloadOnce();
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [user, reloadOnce]);

  const authorId = user?.id ?? '';

  // Separación de libros de negocio: cada usuario (ADMIN INCLUIDO) opera solo
  // sus leads. allLeads queda para las vistas de supervisión/analítica.
  const myLeads = user ? allLeads.filter((l) => l.assignedTo === user.id) : [];

  // Memoized so the context value keeps a stable identity between renders that
  // don't change the data — avoids re-render / effect-refire storms in consumers
  // (e.g. modal focus effects). Recomputed only when the underlying data changes. (#15)
  const value = useMemo<DataContextValue>(() => ({
    loading,
    users,
    leads: myLeads,
    allLeads,
    tasks,
    contacts,
    commentCounts,
    reload,

    async createLead(input) {
      const lead = await leadsService.create(input);
      setAllLeads((prev) => [...prev, lead]);
      return lead;
    },
    async importLeads(inputs) {
      let ok = 0;
      let failed = 0;
      // Persist row by row but DON'T setState per row (avoids O(n²) re-renders);
      // a single reload at the end shows them all. A bad row is skipped. (#8, #14)
      for (const input of inputs) {
        try {
          await leadsService.create(input);
          ok++;
        } catch (e) {
          failed++;
          console.error('[import] fila falló:', e);
        }
      }
      await reload();
      return { ok, failed };
    },
    async updateLead(id, patch) {
      // Un cambio de etapa hecho DESDE EL FORMULARIO de edición entra por aquí
      // (no por move()), así que hay que avisarle a Meta también en este camino.
      // Solo si temperature viene en el patch Y cambió de verdad — así editar
      // otro campo (teléfono, valor…) no reenvía un evento de embudo. El drag y
      // el Copilot pasan por move() y disparan allá; el update() interno de
      // move() no pasa por aquí, así que no hay doble envío.
      //
      // Pipeline v2: igual que move(), el cambio de etapa define SU próxima
      // acción con fecha (stageFollowUpPatch). Los campos que el usuario llenó
      // a mano (nextActionAt/touch) SIEMPRE ganan sobre el automático.
      const prev = allLeads.find((l) => l.id === id);
      let finalPatch = patch;
      if (patch.temperature !== undefined && prev && prev.temperature !== patch.temperature) {
        finalPatch = { ...stageFollowUpPatch(prev, patch.temperature), ...patch };
      }
      const updated = await leadsService.update(id, finalPatch);
      if (updated) setAllLeads((prevLeads) => prevLeads.map((l) => (l.id === id ? updated : l)));
      if (
        patch.temperature !== undefined &&
        prev &&
        prev.temperature !== patch.temperature
      ) {
        notifyMetaStageChange(id, patch.temperature);
      }
    },
    async moveLead(id, temperature) {
      // optimistic for snappy UI…
      setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, temperature } : l)));
      // …then apply the authoritative row (also carries meetingAt/lastContactAt the
      // service set), so a later edit can't resend stale fields. (bug #1)
      const updated = await leadsService.move(id, temperature, authorId);
      if (updated) setAllLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    },
    async commitDrag(leadId, toTemperature, orderedVisibleIds) {
      // One atomic operation: stage change (if any) + column reorder, finished
      // with a SINGLE authoritative reload. No two setLeads racing. (bugs #4, #14)
      const lead = allLeads.find((l) => l.id === leadId);
      if (lead && lead.temperature !== toTemperature) {
        await leadsService.move(leadId, toTemperature, authorId);
      }
      await leadsService.reorderColumn(toTemperature, orderedVisibleIds);
      setAllLeads(await leadsService.list());
    },
    async removeLead(id) {
      await leadsService.remove(id);
      setAllLeads((prev) => prev.filter((l) => l.id !== id));
      setContacts((prev) => prev.filter((c) => c.leadId !== id));
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
      if (updated) setAllLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
    },
    async removeComment(id) {
      await leadsService.removeComment(id);
    },

    async addContact(input) {
      const c = await leadsService.addContact(input);
      setContacts((prev) => [...prev, c]);
    },
    async updateContact(id, patch) {
      await leadsService.updateContact(id, patch);
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    async removeContact(id) {
      await leadsService.removeContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    },

    async createTask(input) {
      const task = await tasksService.create(input);
      setTasks((prev) => [task, ...prev]);
    },
    async toggleTask(id) {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const done = !task.done;
      // A recurring objective "claims" the current period when toggled. (auto-reset)
      const patch: Partial<Task> = {
        done,
        completedAt: done ? new Date().toISOString() : null,
        ...(task.recurring ? { periodKey: currentPeriodKey(task.cadence) } : {}),
      };
      await tasksService.update(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    async setTaskProgress(id, value) {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const progress = Math.max(0, Math.round(value));
      const done = task.target > 0 ? progress >= task.target : task.done;
      const patch: Partial<Task> = {
        progress,
        done,
        completedAt: done ? new Date().toISOString() : null,
        periodKey: task.recurring ? currentPeriodKey(task.cadence) : task.periodKey,
      };
      await tasksService.update(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
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
  }), [loading, users, allLeads, tasks, contacts, commentCounts, authorId, reload, myLeads]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
