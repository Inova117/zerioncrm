import { Building2, Users, ChevronRight, Layers, Repeat } from 'lucide-react';
import type { Lead, User } from '../../types';
import type { CompanyGroup } from '../../lib/companies';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { TemperatureBadge } from '../ui/TemperatureBadge';
import { serviceLabel } from '../../lib/constants';
import { colorFromString, initials, fmtMoney, fromNow } from '../../lib/utils';

interface CompanyDetailModalProps {
  group: CompanyGroup | null;
  open: boolean;
  onClose: () => void;
  usersById: Map<string, User>;
  onOpenLead: (lead: Lead) => void;
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className={`text-lg font-semibold ${className ?? 'text-surface-800'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-surface-400">{label}</p>
    </div>
  );
}

export function CompanyDetailModal({ group, open, onClose, usersById, onOpenLead }: CompanyDetailModalProps) {
  if (!group) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      {/* Header */}
      <div className="-mt-1 mb-4 flex items-start gap-3 pr-9">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: colorFromString(group.name) }}
        >
          {initials(group.name) || <Building2 className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-surface-900">{group.name}</h2>
          <p className="text-sm text-surface-500">{group.industry || 'Empresa'}</p>
          <div className="mt-1.5">
            <TemperatureBadge temperature={group.status} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3 rounded-xl border border-surface-200 p-4 text-center">
        <Stat label="Oportunidades" value={String(group.leads.length)} />
        <Stat label="Valor total" value={fmtMoney(group.totalValue)} />
        <Stat
          label="MRR activo"
          value={group.totalMrr > 0 ? `${fmtMoney(group.totalMrr)}` : '—'}
          className="text-emerald-600"
        />
        <Stat label="Contactos" value={String(group.contacts.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Opportunities */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-800">
            <Layers className="h-4 w-4 text-surface-400" />
            Oportunidades ({group.leads.length})
          </h3>
          <div className="space-y-2">
            {group.leads.map((l) => (
              <button
                key={l.id}
                onClick={() => onOpenLead(l)}
                className="flex w-full items-center gap-2 rounded-lg border border-surface-200 p-2.5 text-left transition-colors hover:border-brand-300 hover:bg-surface-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <TemperatureBadge temperature={l.temperature} />
                    <span className="truncate text-xs text-surface-500">{serviceLabel(l.service)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-xs text-surface-500">
                    <span className="font-medium text-surface-700">{fmtMoney(l.value)}</span>
                    {l.mrr > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600">
                        <Repeat className="h-3 w-3" />
                        {fmtMoney(l.mrr)}/mes
                      </span>
                    )}
                    <span className="text-surface-400">· {fromNow(l.lastContactAt)}</span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-surface-300" />
              </button>
            ))}
          </div>
        </section>

        {/* Contacts */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-800">
            <Users className="h-4 w-4 text-surface-400" />
            Contactos ({group.contacts.length})
          </h3>
          {group.contacts.length === 0 ? (
            <p className="rounded-lg bg-surface-50 px-3 py-3 text-center text-sm text-surface-400">
              Sin contactos. Agrégalos desde cada oportunidad.
            </p>
          ) : (
            <div className="space-y-2">
              {group.contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 rounded-lg border border-surface-200 p-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: colorFromString(c.name) }}
                  >
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-surface-800">{c.name}</p>
                    {c.role && <p className="truncate text-xs text-surface-400">{c.role}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Owners */}
      {group.ownerIds.length > 0 && (
        <div className="mt-5 flex items-center gap-2 border-t border-surface-100 pt-4 text-sm text-surface-500">
          <span className="text-xs uppercase tracking-wide text-surface-400">Responsables</span>
          {group.ownerIds.map((id) => {
            const u = usersById.get(id);
            return u ? <Avatar key={id} name={u.name} color={u.avatarColor} size="sm" /> : null;
          })}
        </div>
      )}
    </Modal>
  );
}
