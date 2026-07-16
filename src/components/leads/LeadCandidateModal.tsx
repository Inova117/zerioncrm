import { useState } from 'react';
import { Phone, MessageCircle, Globe, Mail, Save, Check, Loader2 } from 'lucide-react';
import type { Discovery } from '../../types';
import { Modal } from '../ui/Modal';
import { ScraperInfo } from './ScraperInfo';
import { colorFromString, initials, mailLink, telLink, waLink, webLink } from '../../lib/utils';

interface LeadCandidateModalProps {
  candidate: Discovery | null;
  open: boolean;
  saved: boolean;
  onClose: () => void;
  onSave: (candidate: Discovery) => Promise<void>;
}

/** Preview of a found business (not yet saved) with a Save-to-CRM button. */
export function LeadCandidateModal({ candidate, open, saved, onClose, onSave }: LeadCandidateModalProps) {
  const [saving, setSaving] = useState(false);
  if (!candidate) return null;

  const e = candidate.enrichment ?? {};
  const phone = candidate.phone || e.whatsapp || '';

  async function save() {
    if (!candidate || saving || saved) return;
    setSaving(true);
    try {
      await onSave(candidate);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      {/* Header */}
      <div className="-mt-1 mb-4 flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: colorFromString(candidate.company || '?') }}
        >
          {initials(candidate.company) || '?'}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-surface-900">{candidate.company}</h2>
          <p className="text-sm text-surface-500">{candidate.industry || 'Sin categoría'}</p>
        </div>
      </div>

      {/* Quick contact actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {phone && (
          <>
            <a href={telLink(phone)} className="btn-secondary">
              <Phone className="h-4 w-4" /> Llamar
            </a>
            <a href={waLink(phone)} target="_blank" rel="noreferrer" className="btn-secondary">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </>
        )}
        {candidate.website && (
          <a href={webLink(candidate.website)} target="_blank" rel="noreferrer" className="btn-secondary">
            <Globe className="h-4 w-4" /> Sitio web
          </a>
        )}
        {candidate.email && (
          <a href={mailLink(candidate.email)} className="btn-secondary">
            <Mail className="h-4 w-4" /> Email
          </a>
        )}
      </div>

      {/* Phone line */}
      {phone && (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-surface-600">
          <Phone className="h-4 w-4 text-surface-400" /> {phone}
        </p>
      )}

      {/* Why it's a lead */}
      {candidate.reason && (
        <div className="mb-3 rounded-xl border border-surface-200 p-4">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-surface-400">¿Por qué es cliente potencial?</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-surface-700">{candidate.reason}</p>
        </div>
      )}

      {/* Everything known about the business */}
      <ScraperInfo enrichment={e} website={candidate.website} company={candidate.company} />

      {/* Save */}
      <div className="mt-5 flex justify-end">
        {saved ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Guardado en el CRM
          </span>
        ) : (
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando…' : 'Guardar en el CRM'}
          </button>
        )}
      </div>
    </Modal>
  );
}
