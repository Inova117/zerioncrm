// ============================================================================
// CampaignsPanel — prospección automática diaria: lista + formulario de
// campañas. Solo visible para admin. Una campaña = nicho + ciudad + cuántos/día
// + umbrales por servicio + a quién asignar + URL de la demo del AI agent.
// ============================================================================
import { useState } from 'react';
import { Plus, Pencil, Trash2, Power, Bot, Globe, Loader2 } from 'lucide-react';
import type { ProspectingCampaign, User } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  campaigns: ProspectingCampaign[];
  loading: boolean;
  assignable: User[];
  ownerId: string;
  onSave: (c: ProspectingCampaign) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY = {
  name: '', niche: '', location: '', limitPerDay: 30,
  thWeb: 70, thAas: 70, assignedTo: '', active: true, demoUrl: '',
};

export function CampaignsPanel({ campaigns, loading, assignable, ownerId, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<ProspectingCampaign | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(EMPTY);

  function startNew() {
    setF({ ...EMPTY, assignedTo: ownerId });
    setEditing('new');
  }
  function startEdit(c: ProspectingCampaign) {
    setF({
      name: c.name, niche: c.niche, location: c.location,
      limitPerDay: c.limitPerDay, thWeb: c.thresholds.web ?? 70,
      thAas: c.thresholds.aaas ?? 70, assignedTo: c.assignedTo,
      active: c.active, demoUrl: c.demoAgentUrl,
    });
    setEditing(c);
  }
  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.niche.trim() || !f.location.trim()) return;
    setSaving(true);
    try {
      const existing = editing !== 'new' ? (editing as ProspectingCampaign) : null;
      const camp: ProspectingCampaign = {
        id: existing?.id ?? '',
        ownerId,
        name: f.name.trim() || `${f.niche.trim()} · ${f.location.trim()}`,
        niche: f.niche.trim(),
        location: f.location.trim(),
        limitPerDay: Math.max(1, Math.round(f.limitPerDay) || 30),
        thresholds: { web: f.thWeb, aaas: f.thAas },
        assignedTo: f.assignedTo || ownerId,
        active: f.active,
        demoAgentUrl: f.demoUrl.trim(),
        createdAt: existing?.createdAt ?? '',
        updatedAt: '',
      };
      await onSave(camp);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (id: string) => assignable.find((u) => u.id === id)?.name ?? id;

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-surface-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-surface-900">Campañas automáticas</h3>
          <p className="text-xs text-surface-500">
            Cada mañana traen leads del nicho configurado, con su servicio y su umbral.
          </p>
        </div>
        {editing === null && (
          <button className="btn-primary px-3 py-2 text-sm" onClick={startNew}>
            <Plus className="h-4 w-4" /> Nueva campaña
          </button>
        )}
      </div>

      {editing !== null && (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-medium text-surface-600">
              Nombre (opcional)
              <input className="input mt-1 w-full" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Clínicas Guayaquil" />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Nicho (tipo de negocio)
              <input className="input mt-1 w-full" value={f.niche} onChange={(e) => set('niche', e.target.value)} placeholder="clínicas dentales" required />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Ciudad / zona
              <input className="input mt-1 w-full" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Guayaquil" required />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Negocios por día
              <input className="input mt-1 w-full" type="number" min={1} max={50} value={f.limitPerDay} onChange={(e) => set('limitPerDay', Number(e.target.value))} />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Umbral web (≥)
              <input className="input mt-1 w-full" type="number" min={0} max={100} value={f.thWeb} onChange={(e) => set('thWeb', Number(e.target.value))} />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Umbral AI agent (≥)
              <input className="input mt-1 w-full" type="number" min={0} max={100} value={f.thAas} onChange={(e) => set('thAas', Number(e.target.value))} />
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Asignar leads a
              <select className="input mt-1 w-full" value={f.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
                {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-surface-600">
              Demo del AI agent (URL única)
              <input className="input mt-1 w-full" value={f.demoUrl} onChange={(e) => set('demoUrl', e.target.value)} placeholder="https://… (misma para todos)" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-700">
            <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
            Activa (se ejecuta cada mañana)
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary px-3 py-2 text-sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar campaña'}
            </button>
            <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {campaigns.length === 0 && editing === null ? (
        <div className="rounded-xl border border-dashed border-surface-200 px-6 py-10 text-center text-sm text-surface-400">
          No hay campañas todavía. Crea una para arrancar la prospección automática.
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className={cn('badge shrink-0', c.active ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-100 text-surface-500')}>
                <Power className="h-3 w-3" /> {c.active ? 'Activa' : 'Pausada'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-surface-900">{c.name}</p>
                <p className="text-xs text-surface-500">
                  <Globe className="mr-1 inline h-3 w-3" />{c.niche} · {c.location} · {c.limitPerDay}/día
                  {' · '}web≥{c.thresholds.web} <Bot className="mx-1 inline h-3 w-3" /> aaas≥{c.thresholds.aaas}
                  {' · '}para {nameOf(c.assignedTo)}
                  {c.demoAgentUrl && <span className="text-brand-600"> · demo ✓</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button className="btn-secondary px-2 py-1.5 text-xs" onClick={() => startEdit(c)} title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button className="btn-secondary px-2 py-1.5 text-xs text-red-600" onClick={() => void onDelete(c.id)} title="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
