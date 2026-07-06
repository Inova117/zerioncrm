import { useState } from 'react';
import { UserPlus, RefreshCw } from 'lucide-react';
import type { Role } from '../../types';
import { Modal } from '../ui/Modal';
import type { NewUserInput } from '../../services/usersService';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewUserInput) => Promise<{ error: string | null }>;
}

function randomPassword(): string {
  const words = ['zerion', 'outreach', 'lead', 'cliente', 'meta', 'nova', 'orbita', 'pulso'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}`;
}

export function UserFormModal({ open, onClose, onSubmit }: UserFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(randomPassword());
  const [role, setRole] = useState<Role>('employee');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await onSubmit({ name, email, password, role });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear cuenta de staff"
      subtitle="Solo el administrador puede crear cuentas. El staff entra con estos datos."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nombre completo *</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Lucía Fernández"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">Correo *</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@zerionstudio.com"
            required
          />
        </div>
        <div>
          <label className="label">Contraseña temporal *</label>
          <div className="flex gap-2">
            <input
              className="input font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => setPassword(randomPassword())}
              title="Generar otra"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-surface-400">
            Comparte estos datos con la persona. Podrá cambiarla luego contigo.
          </p>
        </div>
        <div>
          <label className="label">Rol</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="employee">Staff</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            <UserPlus className="h-4 w-4" />
            {saving ? 'Creando…' : 'Crear cuenta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
