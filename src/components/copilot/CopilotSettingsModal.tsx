import { useState } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  getCopilotSettings,
  saveCopilotSettings,
  DEFAULT_PRICE_ONCE,
  DEFAULT_PRICE_MONTHLY,
  type CopilotSettings,
} from '../../lib/copilotSettings';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** "Mi negocio y mi forma de vender" — enséñale al coach cómo vendes tú. */
export function CopilotSettingsModal({ open, onClose, onSaved }: Props) {
  const [s, setS] = useState<CopilotSettings>(() => getCopilotSettings());
  const set = (k: keyof CopilotSettings, v: string) => setS((prev) => ({ ...prev, [k]: v }));

  function save() {
    saveCopilotSettings(s);
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <h2 className="text-lg font-semibold text-surface-900">Ajustes del Copilot</h2>
      <p className="mt-1 text-sm text-surface-500">
        Enséñale al coach cómo vendes tú. Con esto deja de sonar genérico: usa tus precios,
        tu oferta y tu tono por encima del playbook. (Se guarda en este navegador.)
      </p>

      <div className="mt-5 space-y-4">
        <Field
          label="¿Qué vendes y cuál es tu diferenciador?"
          hint="Ej: Páginas web + automatizaciones para negocios locales. Entrego en 2 semanas, con WhatsApp integrado."
          value={s.pitch}
          onChange={(v) => set('pitch', v)}
        />
        <Field
          label="Tus paquetes y precios"
          hint="Ej: Landing $250 (o $80/mes×4). Web + reservas $600. Retainer de mantenimiento $50/mes."
          value={s.offer}
          onChange={(v) => set('offer', v)}
        />
        <Field
          label="Precio principal, HABLADO (el coach lo dice tal cual)"
          hint={`Como se dice en voz alta. Vacío = "${DEFAULT_PRICE_ONCE}". Todo el playbook usa este monto — no hay precios escritos en otro lado.`}
          value={s.priceOnce}
          onChange={(v) => set('priceOnce', v)}
          rows={1}
        />
        <Field
          label="Plan mensual opcional, HABLADO"
          hint={`Vacío = "${DEFAULT_PRICE_MONTHLY}". Se ofrece opt-out después del sí.`}
          value={s.priceMonthly}
          onChange={(v) => set('priceMonthly', v)}
          rows={1}
        />
        <Field
          label="Tono / estilo del coach"
          hint="Ej: Directo pero cálido, ecuatoriano, sin sonar robótico ni agresivo."
          value={s.tone}
          onChange={(v) => set('tone', v)}
          rows={2}
        />
        <Field
          label="Frases y notas que te funcionan"
          hint="Ej: Siempre cierro ofreciendo el diseño de muestra gratis. No bajo de $250. Mi garantía: si no le gusta el diseño, no paga."
          value={s.notes}
          onChange={(v) => set('notes', v)}
        />
        <Field
          label="Tus casos de éxito REALES (la munición de las anécdotas)"
          hint="Ej: Pizzería Don Piero, Quito — primer mes con página: 14 pedidos nuevos por WhatsApp. Solo casos verificables: el coach los usa en una frase al responder objeciones, y sin casos aquí no inventa ninguno."
          value={s.proof}
          onChange={(v) => set('proof', v)}
        />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-primary" onClick={save}>
          <Save className="h-4 w-4" /> Guardar
        </button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea
        className="input mt-1 resize-y"
        rows={rows}
        placeholder={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
