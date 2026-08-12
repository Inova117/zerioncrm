import { useCallback, useEffect, useState } from 'react';
import type {
  CashMove,
  RoadmapActivityStatus,
  RoadmapClient,
  RoadmapDay,
  RoadmapDoc,
  RoadmapMeta,
} from '../types';
import { roadmapService } from '../services/roadmapService';

// ============================================================================
// Estado del módulo Roadmap Zerion. Carga el documento completo una vez y
// aplica mutaciones optimistas (la UI reacciona al instante; el servicio
// persiste en segundo plano — misma filosofía que los demás servicios).
// ============================================================================

export interface UseRoadmap {
  doc: RoadmapDoc | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveDay: (day: RoadmapDay) => Promise<void>;
  setActivityStatus: (id: string, status: RoadmapActivityStatus) => Promise<void>;
  createClient: (input: Omit<RoadmapClient, 'id'>) => Promise<void>;
  updateClient: (id: string, patch: Partial<RoadmapClient>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  addCash: (input: Omit<CashMove, 'id'>) => Promise<void>;
  removeCash: (id: string) => Promise<void>;
  saveMeta: (meta: RoadmapMeta) => Promise<void>;
}

export function useRoadmap(): UseRoadmap {
  const [doc, setDoc] = useState<RoadmapDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setDoc(await roadmapService.load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el roadmap');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveDay = useCallback(async (day: RoadmapDay) => {
    setDoc((d) =>
      d ? { ...d, days: d.days.some((x) => x.day === day.day) ? d.days.map((x) => (x.day === day.day ? day : x)) : [...d.days, day] } : d
    );
    await roadmapService.saveDay(day);
  }, []);

  const setActivityStatus = useCallback(async (id: string, status: RoadmapActivityStatus) => {
    setDoc((d) =>
      d ? { ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, status } : a)) } : d
    );
    await roadmapService.setActivityStatus(id, status);
  }, []);

  const createClient = useCallback(async (input: Omit<RoadmapClient, 'id'>) => {
    const created = await roadmapService.createClient(input);
    setDoc((d) => (d ? { ...d, clients: [...d.clients, created] } : d));
  }, []);

  const updateClient = useCallback(async (id: string, patch: Partial<RoadmapClient>) => {
    setDoc((d) =>
      d ? { ...d, clients: d.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : d
    );
    await roadmapService.updateClient(id, patch);
  }, []);

  const removeClient = useCallback(async (id: string) => {
    setDoc((d) => (d ? { ...d, clients: d.clients.filter((c) => c.id !== id) } : d));
    await roadmapService.removeClient(id);
  }, []);

  const addCash = useCallback(async (input: Omit<CashMove, 'id'>) => {
    const created = await roadmapService.addCash(input);
    setDoc((d) => (d ? { ...d, cash: [created, ...d.cash] } : d));
  }, []);

  const removeCash = useCallback(async (id: string) => {
    setDoc((d) => (d ? { ...d, cash: d.cash.filter((m) => m.id !== id) } : d));
    await roadmapService.removeCash(id);
  }, []);

  const saveMeta = useCallback(async (meta: RoadmapMeta) => {
    setDoc((d) => (d ? { ...d, meta } : d));
    await roadmapService.saveMeta(meta);
  }, []);

  return {
    doc,
    loading,
    error,
    reload,
    saveDay,
    setActivityStatus,
    createClient,
    updateClient,
    removeClient,
    addCash,
    removeCash,
    saveMeta,
  };
}
