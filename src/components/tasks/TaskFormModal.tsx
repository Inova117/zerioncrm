import { useState } from 'react';
import type { Lead, TaskCadence, User } from '../../types';
import { Modal } from '../ui/Modal';
import { CADENCES } from '../../lib/constants';
import type { NewTaskInput } from '../../services/tasksService';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewTaskInput) => Promise<void>;
  employees: User[];
  leads: Lead[];
  currentUserId: string;
  isAdmin: boolean;
  defaultCadence?: TaskCadence;
}

export function TaskFormModal({
  open,
  onClose,
  onSubmit,
  employees,
  leads,
  currentUserId,
  isAdmin,
  defaultCadence = 'daily',
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [cadence, setCadence] = useState<TaskCadence>(defaultCadence);
  // Admins assign to a team member, so default to the first employee shown in the
  // dropdown (never the admin's own id, which isn't an option and would be saved
  // silently). Employees always own their own tasks.
  const [assignedTo, setAssignedTo] = useState(
    isAdmin ? employees[0]?.id ?? currentUserId : currentUserId
  );
  const [leadId, setLeadId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [recurring, setRecurring] = useState(true);
  const [target, setTarget] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSubmit({
      title: title.trim(),
      notes: notes.trim(),
      cadence,
      assignedTo,
      leadId: leadId || null,
      // Parse the date-only input in LOCAL time, not UTC midnight — otherwise it
      // shifts a day back for users west of UTC (México/LatAm). (bug #3)
      dueDate: recurring || !dueDate ? null : new Date(`${dueDate}T00:00:00`).toISOString(),
      recurring,
      target: target > 0 ? Math.round(target) : 0,
    });
    setSaving(false);
    onClose();
  }

  const assignableLeads = isAdmin ? leads : leads.filter((l) => l.assignedTo === currentUserId);

  return (
    <Modal open={open} onClose={onClose} title="Nueva tarea" subtitle="Define objetivos de outreach.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Tarea *</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Contactar 10 empresas nuevas"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">Notas</label>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalle opcional"
          />
        </div>
        {/* Recurring objective vs one-off task */}
        <div className="rounded-lg border border-surface-200 p-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium text-surface-800">Objetivo recurrente</span>
              <span className="block text-xs text-surface-400">
                Se reinicia solo cada {cadence === 'daily' ? 'día' : cadence === 'weekly' ? 'semana' : 'mes'} — no
                hay que crearlo de nuevo. Desactívalo para una tarea única con fecha.
              </span>
            </span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Frecuencia</label>
            <select
              className="input"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as TaskCadence)}
            >
              {CADENCES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Meta (número, opcional)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={target || ''}
              onChange={(e) => setTarget(Number(e.target.value) || 0)}
              placeholder="Ej. 25 contactos"
            />
          </div>
          {!recurring && (
            <div>
              <label className="label">Fecha límite</label>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}
          {isAdmin && (
            <div>
              <label className="label">Asignar a</label>
              <select
                className="input"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Prospecto (opcional)</label>
            <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">Sin vincular</option>
              {assignableLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.company}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
