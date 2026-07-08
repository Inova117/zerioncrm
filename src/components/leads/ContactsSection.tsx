import { useMemo, useState } from 'react';
import { Users, Plus, Mail, Phone, MessageCircle, Trash2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { cn, colorFromString, initials, mailLink, telLink, waLink } from '../../lib/utils';

const emptyForm = { name: '', role: '', email: '', phone: '' };

export function ContactsSection({ leadId }: { leadId: string }) {
  const { contacts, addContact, removeContact } = useData();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const myContacts = useMemo(
    () => contacts.filter((c) => c.leadId === leadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [contacts, leadId]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await addContact({ leadId, ...form, name: form.name.trim() });
      setForm(emptyForm);
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-xl border border-surface-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-surface-800">
          <Users className="h-4 w-4 text-surface-400" />
          Contactos
          {myContacts.length > 0 && (
            <span className="text-xs font-normal text-surface-400">({myContacts.length})</span>
          )}
        </p>
        {!adding && (
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Añadir
          </button>
        )}
      </div>

      {myContacts.length === 0 && !adding && (
        <p className="rounded-lg bg-surface-50 px-3 py-3 text-center text-sm text-surface-400">
          Sin contactos aún. Agrega a las personas de esta cuenta.
        </p>
      )}

      <div className="space-y-2">
        {myContacts.map((c) => (
          <div key={c.id} className="group flex items-center gap-2.5 rounded-lg border border-surface-200 p-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: colorFromString(c.name) }}
            >
              {initials(c.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-surface-800">{c.name}</p>
              {c.role && <p className="truncate text-xs text-surface-400">{c.role}</p>}
            </div>
            <div className="flex items-center gap-1">
              {c.email && (
                <a href={mailLink(c.email)} className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-brand-600" title={c.email}>
                  <Mail className="h-4 w-4" />
                </a>
              )}
              {c.phone && (
                <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-emerald-600" title="WhatsApp">
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
              {c.phone && (
                <a href={telLink(c.phone)} className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700" title="Llamar">
                  <Phone className="h-4 w-4" />
                </a>
              )}
              <button
                onClick={() => removeContact(c.id)}
                className="rounded p-1.5 text-surface-300 opacity-0 transition-opacity hover:text-caliente group-hover:opacity-100"
                title="Eliminar contacto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg border border-brand-200 p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <input className="input py-1.5 text-sm" placeholder="Nombre *" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus required />
            <input className="input py-1.5 text-sm" placeholder="Cargo" value={form.role} onChange={(e) => set('role', e.target.value)} />
            <input className="input py-1.5 text-sm" placeholder="Correo" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <input className="input py-1.5 text-sm" placeholder="Teléfono" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <button type="submit" className={cn('btn-primary px-2.5 py-1 text-xs', saving && 'opacity-60')} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar contacto'}
            </button>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => { setAdding(false); setForm(emptyForm); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
