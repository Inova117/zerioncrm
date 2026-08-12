import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Plus, Repeat, Save, ShieldCheck, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { CashMove, RoadmapClient, RoadmapClientStatus, RoadmapMeta, RoadmapProduct } from '../../types';
import { REF_COSTS } from '../../data/roadmapDefaults';
import { cashBalance, reserveStatus, todayKey } from '../../lib/roadmapCalc';
import { Modal } from '../ui/Modal';
import { StatCard } from '../dashboard/StatCard';
import { fmtMoney, cn } from '../../lib/utils';

interface FinanzasTabProps {
  meta: RoadmapMeta;
  clients: RoadmapClient[];
  cash: CashMove[];
  createClient: (input: Omit<RoadmapClient, 'id'>) => Promise<void>;
  updateClient: (id: string, patch: Partial<RoadmapClient>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  addCash: (input: Omit<CashMove, 'id'>) => Promise<void>;
  removeCash: (id: string) => Promise<void>;
  saveMeta: (meta: RoadmapMeta) => Promise<void>;
}

const fmtShort = (d: string) => format(parseISO(d), 'd MMM', { locale: es });

const PRODUCT_LABEL: Record<RoadmapProduct, string> = { web: 'Web', aaas: 'AaaS', otro: 'Otro' };
const STATUS_LABEL: Record<RoadmapClientStatus, string> = { activo: 'Activo', pausado: 'Pausado', baja: 'Baja' };

/** Modal de cliente (crear/editar). */
function ClientFormModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: RoadmapClient | null;
  onSave: (input: Omit<RoadmapClient, 'id'>, id: string | null) => Promise<void>;
}) {
  const empty = { name: '', product: 'web' as RoadmapProduct, startDate: null, setup: 0, monthly: 0, status: 'activo' as RoadmapClientStatus, notes: '' };
  const [f, setF] = useState<Omit<RoadmapClient, 'id'>>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(
      initial
        ? { name: initial.name, product: initial.product, startDate: initial.startDate, setup: initial.setup, monthly: initial.monthly, status: initial.status, notes: initial.notes }
        : empty
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    await onSave({ ...f, name: f.name.trim() }, initial?.id ?? null);
    setSaving(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar cliente' : 'Nuevo cliente'} subtitle="Su mensualidad alimenta el MRR actual." size="md">
      <div className="space-y-3">
        <div>
          <label className="label">Nombre del negocio</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Clínica Dental Sonrisa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Producto</label>
            <select className="input" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value as RoadmapProduct })}>
              <option value="web">Web ($200)</option>
              <option value="aaas">AaaS ($250/mes)</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as RoadmapClientStatus })}>
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Inicio</label>
            <input type="date" className="input" value={f.startDate ?? ''} onChange={(e) => setF({ ...f, startDate: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Setup ($)</label>
            <input type="number" min={0} className="input" value={f.setup} onChange={(e) => setF({ ...f, setup: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
          <div>
            <label className="label">Mensualidad ($)</label>
            <input type="number" min={0} className="input" value={f.monthly} onChange={(e) => setF({ ...f, monthly: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
        </div>
        <div>
          <label className="label">Notas</label>
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Reporte los viernes…" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={submit} disabled={saving || !f.name.trim()}>
          <Save className="h-4 w-4" />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}

/** Finanzas: clientes (MRR), caja, saldo y reserva intocable. */
export function FinanzasTab({ meta, clients, cash, createClient, updateClient, removeClient, addCash, removeCash, saveMeta }: FinanzasTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoadmapClient | null>(null);
  const balance = cashBalance(cash);
  const reserve = reserveStatus(balance.net, meta.reserve);
  const mrrActive = clients.filter((c) => c.status === 'activo').reduce((a, c) => a + c.monthly, 0);
  const [reserveDraft, setReserveDraft] = useState(String(meta.reserve));
  useEffect(() => setReserveDraft(String(meta.reserve)), [meta.reserve]);

  // Form rápido de caja
  const [cashForm, setCashForm] = useState({ day: todayKey(), concept: '', income: '', expense: '' });

  const submitCash = async () => {
    const income = Number(cashForm.income) || 0;
    const expense = Number(cashForm.expense) || 0;
    if (income === 0 && expense === 0 && !cashForm.concept.trim()) return;
    await addCash({ day: cashForm.day, concept: cashForm.concept.trim(), income, expense });
    setCashForm({ day: todayKey(), concept: '', income: '', expense: '' });
  };

  const handleClientSave = async (input: Omit<RoadmapClient, 'id'>, id: string | null) => {
    if (id) await updateClient(id, input);
    else await createClient(input);
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="MRR activo"
          value={mrrActive > 0 ? `${fmtMoney(mrrActive)}/mes` : '—'}
          hint={`${clients.filter((c) => c.status === 'activo').length} clientes activos`}
          icon={<Repeat className="h-4 w-4" />}
          accent="text-emerald-600"
          accentBg="bg-emerald-50"
        />
        <StatCard label="Ingresos caja" value={fmtMoney(balance.income)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Egresos caja" value={fmtMoney(balance.expense)} icon={<TrendingDown className="h-4 w-4" />} accent="text-caliente" accentBg="bg-red-50" />
        <StatCard
          label="Saldo neto"
          value={fmtMoney(balance.net)}
          hint={
            reserve === 'ok'
              ? `Reserva de ${fmtMoney(meta.reserve)} intacta ✓`
              : reserve === 'warn'
                ? 'Debajo de la reserva intocable'
                : 'En rojo — saldo negativo'
          }
          icon={<Wallet className="h-4 w-4" />}
          accent={reserve === 'ok' ? 'text-emerald-600' : reserve === 'warn' ? 'text-amber-600' : 'text-caliente'}
          accentBg={reserve === 'ok' ? 'bg-emerald-50' : reserve === 'warn' ? 'bg-amber-50' : 'bg-red-50'}
        />
      </div>

      {/* Reserva editable */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-surface-800">Reserva intocable</p>
          <p className="text-xs text-surface-400">Mínimo $3.000 = 3 meses de vida. No se toca para gastos del negocio.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-400">$</span>
          <input
            type="number"
            min={0}
            className="input w-28 text-right"
            value={reserveDraft}
            onChange={(e) => setReserveDraft(e.target.value)}
            onBlur={() => saveMeta({ ...meta, reserve: Math.max(0, Number(reserveDraft) || 0) })}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Clientes */}
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-surface-800">Clientes y mensualidades</h2>
              <p className="text-xs text-surface-400">MRR = suma la mensualidad de clientes Activos.</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Cliente
            </button>
          </div>
          {clients.length === 0 ? (
            <p className="py-6 text-center text-sm text-surface-400">
              Aún no hay clientes. Cuando cierres el primero, anótalo aquí.
            </p>
          ) : (
            <ul className="divide-y divide-surface-100">
              {clients.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-800">{c.name}</p>
                    <p className="text-xs text-surface-400">
                      {PRODUCT_LABEL[c.product]} · inicio {c.startDate ? fmtShort(c.startDate) : '—'} · setup {fmtMoney(c.setup)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-surface-800">
                      {c.monthly > 0 ? `${fmtMoney(c.monthly)}/mes` : '—'}
                    </p>
                    <span
                      className={cn(
                        'badge',
                        c.status === 'activo' ? 'bg-emerald-50 text-emerald-700' : c.status === 'pausado' ? 'bg-amber-50 text-amber-700' : 'bg-surface-100 text-surface-500'
                      )}
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <button type="button" className="btn-ghost rounded-lg p-1.5 text-surface-400" title="Editar" onClick={() => { setEditing(c); setModalOpen(true); }}>
                    <DollarSign className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost rounded-lg p-1.5 text-surface-400 hover:text-caliente" title="Eliminar" onClick={() => removeClient(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Caja */}
        <section className="card p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-surface-800">Caja — ingresos y egresos</h2>
            <p className="text-xs text-surface-400">Anota todo lo que entra y sale.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto]">
            <input type="date" className="input" value={cashForm.day} onChange={(e) => setCashForm({ ...cashForm, day: e.target.value })} />
            <input className="input" placeholder="Concepto" value={cashForm.concept} onChange={(e) => setCashForm({ ...cashForm, concept: e.target.value })} />
            <input type="number" min={0} className="input" placeholder="Ingreso $" value={cashForm.income} onChange={(e) => setCashForm({ ...cashForm, income: e.target.value })} />
            <input type="number" min={0} className="input" placeholder="Egreso $" value={cashForm.expense} onChange={(e) => setCashForm({ ...cashForm, expense: e.target.value })} />
            <button type="button" className="btn-primary" onClick={submitCash} aria-label="Añadir movimiento">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {cash.length === 0 ? (
            <p className="py-6 text-center text-sm text-surface-400">Sin movimientos aún.</p>
          ) : (
            <ul className="mt-3 max-h-72 divide-y divide-surface-100 overflow-y-auto">
              {cash.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="w-14 shrink-0 text-xs text-surface-400">{fmtShort(m.day)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-surface-700">{m.concept || '—'}</span>
                  {m.income > 0 && <span className="text-sm font-medium text-emerald-600">+{fmtMoney(m.income)}</span>}
                  {m.expense > 0 && <span className="text-sm font-medium text-caliente">−{fmtMoney(m.expense)}</span>}
                  <button type="button" className="btn-ghost rounded-lg p-1.5 text-surface-400 hover:text-caliente" title="Eliminar" onClick={() => removeCash(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-surface-200 pt-3 text-sm">
            <span className="font-medium text-surface-600">Saldo neto</span>
            <span className={cn('font-semibold', balance.net >= 0 ? 'text-surface-900' : 'text-caliente')}>{fmtMoney(balance.net)}</span>
          </div>
        </section>
      </div>

      <p className="text-xs text-surface-400">
        <strong className="text-surface-500">Costos de referencia:</strong> {REF_COSTS}
      </p>

      <ClientFormModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} onSave={handleClientSave} />
    </div>
  );
}
