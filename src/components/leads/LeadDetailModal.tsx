import { useEffect, useState } from 'react';
import {
  Mail,
  Phone,
  Globe,
  Building2,
  MessageSquarePlus,
  Pencil,
  Trash2,
  Send,
  ArrowRightLeft,
  CalendarClock,
  MessageCircle,
  Target,
  Layers,
  Repeat,
  DollarSign,
} from 'lucide-react';
import type { Comment, Lead, Temperature, User, ActivityType } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { TemperatureBadge } from '../ui/TemperatureBadge';
import { STAGES, sourceLabel, serviceLabel } from '../../lib/constants';
import { cn, fmtDateTime, fmtMoney, fromNow, mailLink, telLink, waLink, webLink } from '../../lib/utils';

interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  owner?: User;
  usersById: Map<string, User>;
  onEdit: (lead: Lead) => void;
  onMove: (leadId: string, to: Temperature) => Promise<void> | void;
  onDelete: (leadId: string) => Promise<void>;
  loadComments: (leadId: string) => Promise<Comment[]>;
  addComment: (leadId: string, body: string) => Promise<void>;
}

const activityMeta: Record<ActivityType, { icon: typeof MessageCircle; className: string }> = {
  comment: { icon: MessageCircle, className: 'bg-surface-100 text-surface-500' },
  stage_change: { icon: ArrowRightLeft, className: 'bg-brand-50 text-brand-600' },
  contact: { icon: Phone, className: 'bg-blue-50 text-blue-600' },
  meeting: { icon: CalendarClock, className: 'bg-violet-50 text-violet-600' },
};

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-surface-400">{label}</p>
        <p className="truncate text-sm text-surface-700">{value || '—'}</p>
      </div>
    </div>
  );
}

export function LeadDetailModal({
  lead,
  open,
  onClose,
  owner,
  usersById,
  onEdit,
  onMove,
  onDelete,
  loadComments,
  addComment,
}: LeadDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Key the effect on the lead id (stable), NOT the lead object or loadComments
  // (both change identity on every provider render), so it doesn't re-fetch and
  // reset confirmDelete on each unrelated state update. (bug #20)
  const leadId = lead?.id;
  useEffect(() => {
    if (!leadId || !open) return;
    let cancelled = false; // ignore a stale in-flight response (bug #21)
    setLoading(true);
    setConfirmDelete(false);
    setDraft(''); // don't leak a half-typed comment onto another lead (bug #8)
    loadComments(leadId)
      .then((c) => !cancelled && setComments(c))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, open]);

  if (!lead) return null;

  async function refresh() {
    if (!lead) return;
    setComments(await loadComments(lead.id));
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !draft.trim() || submitting) return; // guard double submit (bug #7)
    setSubmitting(true);
    try {
      await addComment(lead.id, draft.trim());
      setDraft('');
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStage(to: Temperature) {
    if (!lead || to === lead.temperature) return;
    await onMove(lead.id, to);
    await refresh();
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      {/* Header (pr-9 leaves room for the modal's corner close button) */}
      <div className="-mt-1 mb-4 flex flex-wrap items-start justify-between gap-3 pr-9">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">{lead.company}</h2>
            <p className="text-sm text-surface-500">
              {lead.contactName}
              {lead.role ? ` · ${lead.role}` : ''}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <TemperatureBadge temperature={lead.temperature} />
              {owner && (
                <span className="flex items-center gap-1.5 text-xs text-surface-400">
                  <Avatar name={owner.name} color={owner.avatarColor} size="sm" />
                  {owner.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => onEdit(lead)}>
            <Pencil className="h-4 w-4" /> Editar
          </button>
          {confirmDelete ? (
            <button
              className="btn-danger"
              onClick={async () => {
                await onDelete(lead.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> Confirmar
            </button>
          ) : (
            <button
              className="btn-ghost text-surface-400 hover:text-caliente"
              onClick={() => setConfirmDelete(true)}
              title="Eliminar prospecto"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick contact actions — open the user's mail / phone / WhatsApp app. */}
      {(lead.email || lead.phone || lead.website) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {lead.email && (
            <a href={mailLink(lead.email)} className="btn-secondary" onClick={(e) => e.stopPropagation()}>
              <Mail className="h-4 w-4" /> Email
            </a>
          )}
          {lead.phone && (
            <a
              href={waLink(lead.phone)}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-emerald-600"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {lead.phone && (
            <a href={telLink(lead.phone)} className="btn-secondary">
              <Phone className="h-4 w-4" /> Llamar
            </a>
          )}
          {lead.website && (
            <a href={webLink(lead.website)} target="_blank" rel="noreferrer" className="btn-secondary">
              <Globe className="h-4 w-4" /> Sitio web
            </a>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: details */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-surface-200 p-4">
            <InfoRow icon={Mail} label="Correo" value={lead.email} />
            <InfoRow icon={Phone} label="Teléfono" value={lead.phone} />
            <InfoRow icon={Globe} label="Sitio web" value={lead.website} />
            <InfoRow icon={Building2} label="Industria" value={lead.industry} />
            <InfoRow icon={Target} label="Fuente" value={sourceLabel(lead.source)} />
            <InfoRow icon={Layers} label="Servicio" value={serviceLabel(lead.service)} />
            <InfoRow icon={MessageCircle} label="Canal" value={lead.channel} />
            <InfoRow icon={DollarSign} label="Presupuesto" value={fmtMoney(lead.value)} />
            <InfoRow
              icon={Repeat}
              label="Retainer / MRR"
              value={lead.mrr > 0 ? `${fmtMoney(lead.mrr)}/mes` : '—'}
            />
            <InfoRow
              icon={CalendarClock}
              label="Reunión"
              value={lead.meetingAt ? fmtDateTime(lead.meetingAt) : '—'}
            />
          </div>

          <div className="rounded-xl border border-surface-200 p-4">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-surface-400">
              ¿Por qué es cliente potencial?
            </p>
            <p className="text-sm leading-relaxed text-surface-700">
              {lead.reason || 'Sin descripción.'}
            </p>
          </div>

          {/* Stage switcher */}
          <div className="rounded-xl border border-surface-200 p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-surface-400">
              Mover a etapa
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => {
                const active = s.key === lead.temperature;
                return (
                  <button
                    key={s.key}
                    onClick={() => changeStage(s.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? cn(s.soft, s.text, s.ring)
                        : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: activity */}
        <div className="flex min-h-0 flex-col">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-800">
            <MessageSquarePlus className="h-4 w-4 text-surface-400" />
            Comentarios y actividad
          </p>

          <form onSubmit={submitComment} className="mb-3">
            <div className="flex items-end gap-2">
              <textarea
                className="input min-h-[42px] resize-none py-2"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un comentario sobre este prospecto…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(e);
                }}
              />
              <button
                type="submit"
                className="btn-primary shrink-0"
                disabled={!draft.trim() || submitting}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {loading && <p className="text-sm text-surface-400">Cargando actividad…</p>}
            {!loading && comments.length === 0 && (
              <p className="rounded-lg bg-surface-50 px-3 py-4 text-center text-sm text-surface-400">
                Aún no hay comentarios. Sé el primero en anotar algo.
              </p>
            )}
            {comments.map((c) => {
              const meta = activityMeta[c.type];
              const Icon = meta.icon;
              // Don't misattribute an ex-employee's activity to the current viewer;
              // show a neutral label if the author no longer exists. (bug #16)
              const author = usersById.get(c.authorId);
              const authorName = author ? author.name.split(' ')[0] : 'Usuario eliminado';
              return (
                <div key={c.id} className="flex gap-3">
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      meta.className
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-surface-700">{c.body}</p>
                    <p className="mt-0.5 text-[11px] text-surface-400">
                      {authorName} · {fromNow(c.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
