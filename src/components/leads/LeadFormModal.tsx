import { useState } from 'react';
import type { Lead, Source, Temperature, User } from '../../types';
import { Modal } from '../ui/Modal';
import { SOURCES, STAGES } from '../../lib/constants';
import type { NewLeadInput } from '../../services/leadsService';

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewLeadInput) => Promise<void>;
  employees: User[];
  currentUserId: string;
  isAdmin: boolean;
  initial?: Lead | null;
}

const empty = (assignedTo: string): NewLeadInput => ({
  company: '',
  contactName: '',
  role: '',
  email: '',
  phone: '',
  website: '',
  industry: '',
  source: 'linkedin',
  channel: '',
  reason: '',
  temperature: 'nuevo',
  value: 0,
  assignedTo,
});

export function LeadFormModal({
  open,
  onClose,
  onSubmit,
  employees,
  currentUserId,
  isAdmin,
  initial,
}: LeadFormModalProps) {
  const [form, setForm] = useState<NewLeadInput>(
    initial ? { ...initial } : empty(currentUserId)
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NewLeadInput>(k: K, v: NewLeadInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) return;
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? 'Editar prospecto' : 'Nuevo prospecto'}
      subtitle="Registra a quién contactas y por qué es un cliente potencial."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Empresa *</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="Nombre de la empresa"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Contacto</label>
            <input
              className="input"
              value={form.contactName}
              onChange={(e) => set('contactName', e.target.value)}
              placeholder="Nombre de la persona"
            />
          </div>
          <div>
            <label className="label">Cargo</label>
            <input
              className="input"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              placeholder="Dueño, Gerente…"
            />
          </div>
          <div>
            <label className="label">Correo</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contacto@empresa.com"
            />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+52 …"
            />
          </div>
          <div>
            <label className="label">Industria</label>
            <input
              className="input"
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
              placeholder="Restaurantes, Salud…"
            />
          </div>
          <div>
            <label className="label">Sitio web</label>
            <input
              className="input"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder="empresa.com"
            />
          </div>
          <div>
            <label className="label">Canal / dónde le escribiste</label>
            <input
              className="input"
              value={form.channel}
              onChange={(e) => set('channel', e.target.value)}
              placeholder="DM en Instagram, correo en frío…"
            />
          </div>
          <div>
            <label className="label">Fuente</label>
            <select
              className="input"
              value={form.source}
              onChange={(e) => set('source', e.target.value as Source)}
            >
              {SOURCES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Temperatura</label>
            <select
              className="input"
              value={form.temperature}
              onChange={(e) => set('temperature', e.target.value as Temperature)}
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Valor estimado (USD)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={form.value || ''}
              onChange={(e) => set('value', Number(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          {isAdmin && (
            <div>
              <label className="label">Asignado a</label>
              <select
                className="input"
                value={form.assignedTo}
                onChange={(e) => set('assignedTo', e.target.value)}
              >
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="label">¿Por qué es un cliente potencial?</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            placeholder="Ej. Publican a diario en redes pero su web está desactualizada…"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear prospecto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
