import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  CalendarDays,
  Check,
  Clock3,
  MessageCircle,
  Phone,
  PhoneCall,
  Sparkles,
  SunMedium,
} from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { TemperatureBadge } from '../components/ui/TemperatureBadge';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useData } from '../context/DataContext';
import type { Lead } from '../types';
import { advanceTouch, followUpBucket, localAt, touchInfo } from '../lib/followUp';
import { fillLeadVars } from '../lib/scriptUtils';
import { fillPrecios } from '../lib/copilotSettings';
import { cn, fmtDateTime, telLink, waLink } from '../lib/utils';

/** El mensaje del toque con las variables del prospecto resueltas
 *  ([NOMBRE] → "Héctor", [PRECIO] → el de Ajustes, etc.). */
function filledMessage(lead: Lead, raw: string): string {
  return fillLeadVars(fillPrecios(raw), lead);
}

function FollowUpCard({
  lead,
  bucket,
  onAdvance,
  onSnooze,
  busy,
}: {
  lead: Lead;
  bucket: 'overdue' | 'today' | 'upcoming';
  onAdvance: (lead: Lead) => void;
  onSnooze: (lead: Lead) => void;
  busy: boolean;
}) {
  const info = touchInfo(lead);
  if (!info) return null;
  const msg = info.message ? filledMessage(lead, info.message) : '';
  const isCall = info.channel === 'llamada';

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm transition-colors',
        bucket === 'overdue'
          ? 'border-red-200 bg-red-50/40'
          : bucket === 'today'
            ? 'border-amber-200 bg-amber-50/40'
            : 'border-surface-200'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-surface-900">{lead.company}</p>
            <TemperatureBadge temperature={lead.temperature} />
            <span className="badge bg-surface-100 text-surface-600">
              {info.touch}/{info.total > 0 ? info.total : '∞'} · {info.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-surface-500">
            {lead.contactName || 'Sin contacto'}
            {lead.industry ? ` · ${lead.industry}` : ''}
          </p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            bucket === 'overdue' ? 'text-red-600' : bucket === 'today' ? 'text-amber-700' : 'text-surface-400'
          )}
        >
          <Clock3 className="h-3.5 w-3.5" />
          {fmtDateTime(lead.nextActionAt)}
        </div>
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-sm text-surface-700">
        <span className="mt-0.5 shrink-0">
          {isCall ? <PhoneCall className="h-3.5 w-3.5 text-blue-500" /> : <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />}
        </span>
        {info.action}
      </p>

      {msg && (
        <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm italic text-surface-600 ring-1 ring-surface-200">
          «{msg}»
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isCall ? (
          lead.phone && (
            <a href={telLink(lead.phone)} className="btn-primary px-3 py-1.5 text-xs">
              <Phone className="h-3.5 w-3.5" /> Llamar
            </a>
          )
        ) : (
          lead.phone && (
            <a
              href={waLink(lead.phone, msg)}
              target="_blank"
              rel="noreferrer"
              className="btn-primary px-3 py-1.5 text-xs text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
            </a>
          )
        )}
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          onClick={() => onAdvance(lead)}
          disabled={busy}
          title="Completé este toque — el sistema agenda el siguiente"
        >
          <Check className="h-3.5 w-3.5" /> Hecho → siguiente
        </button>
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={() => onSnooze(lead)}
          disabled={busy}
          title="Posponer a mañana a las 10:00"
        >
          <Clock3 className="h-3.5 w-3.5" /> Mañana
        </button>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <Link
            to={`/leads?lead=${lead.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-surface-500 hover:text-brand-600 hover:underline"
            title="Abrir el prospecto en el tab Prospectos"
          >
            Ver prospecto
          </Link>
          <Link
            to={`/copilot?lead=${lead.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" /> Copilot
          </Link>
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  accent,
}: {
  title: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className={cn('flex items-center gap-2 text-sm font-semibold', accent ?? 'text-surface-700')}>
        <Icon className="h-4 w-4" /> {title}
      </h2>
      {children}
    </section>
  );
}

export function HoyPage() {
  const { loading, leads, moveLead, updateLead } = useData();
  const [busyId, setBusyId] = useState<string | null>(null);

  const byBucket = useMemo(() => {
    const overdue: Lead[] = [];
    const today: Lead[] = [];
    const upcoming: Lead[] = [];
    const weekFromNow = Date.now() + 7 * 86_400_000;
    for (const l of leads) {
      const b = followUpBucket(l.nextActionAt);
      if (b === 'overdue') overdue.push(l);
      else if (b === 'today') today.push(l);
      else if (b === 'upcoming' && l.nextActionAt && new Date(l.nextActionAt).getTime() <= weekFromNow) upcoming.push(l);
    }
    const byDate = (a: Lead, b: Lead) =>
      (a.nextActionAt ?? '').localeCompare(b.nextActionAt ?? '');
    overdue.sort(byDate);
    today.sort(byDate);
    upcoming.sort(byDate);
    return { overdue, today, upcoming };
  }, [leads]);

  const nuevos = useMemo(
    () =>
      leads
        .filter((l) => l.temperature === 'nuevo')
        .sort((a, b) => (b.enrichment?.score ?? 0) - (a.enrichment?.score ?? 0)),
    [leads]
  );

  async function handleAdvance(lead: Lead) {
    if (busyId) return;
    setBusyId(lead.id);
    try {
      const patch = advanceTouch(lead);
      if (patch.temperature && patch.temperature !== lead.temperature) {
        // La secuencia terminó → cambia de etapa (p.ej. demo d14 → reactivación);
        // move() aplica las fechas/toque de la etapa nueva.
        await moveLead(lead.id, patch.temperature);
      } else {
        await updateLead(lead.id, patch);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleSnooze(lead: Lead) {
    if (busyId) return;
    setBusyId(lead.id);
    try {
      await updateLead(lead.id, { nextActionAt: localAt(1) });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PageLoader />;

  const queueTotal = byBucket.overdue.length + byBucket.today.length;
  const allEmpty = queueTotal === 0 && byBucket.upcoming.length === 0 && nuevos.length === 0;

  return (
    <AppLayout
      title="Hoy"
      subtitle={
        queueTotal > 0
          ? `Tienes ${queueTotal} seguimiento${queueTotal === 1 ? '' : 's'} pendiente${queueTotal === 1 ? '' : 's'} — nada más importa.`
          : 'Todo al día: la cola de seguimiento está vacía.'
      }
    >
      {allEmpty ? (
        <EmptyState
          icon={<SunMedium className="h-10 w-10" />}
          title="Nada pendiente 🎉"
          description="Sin seguimientos ni llamadas en cola. Ve al Lead Finder a por más prospectos."
        />
      ) : (
        <div className="space-y-8">
          {/* Por contactar: la cola de llamadas en frío */}
          {nuevos.length > 0 && (
            <Section title={`Por contactar — ${nuevos.length} nuevo${nuevos.length === 1 ? '' : 's'}`} icon={PhoneCall} accent="text-blue-600">
              <div className="space-y-2">
                {nuevos.slice(0, 8).map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-surface-900">
                        {l.company}
                        {l.enrichment?.rating ? (
                          <span className="ml-1.5 text-xs font-normal text-surface-400">
                            ⭐ {l.enrichment.rating} ({l.enrichment.reviewCount ?? '?'})
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-surface-500">
                        {l.industry || 'Sin rubro'}
                        {l.contactName ? ` · ${l.contactName}` : ''}
                      </p>
                    </div>
                    {l.phone && (
                      <a href={telLink(l.phone)} className="btn-secondary px-3 py-1.5 text-xs">
                        <Phone className="h-3.5 w-3.5" /> Llamar
                      </a>
                    )}
                    <Link to={`/copilot?lead=${l.id}`} className="btn-primary px-3 py-1.5 text-xs">
                      <Sparkles className="h-3.5 w-3.5" /> Vender
                    </Link>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Atrasado */}
          {byBucket.overdue.length > 0 && (
            <Section
              title={`Atrasado — ${byBucket.overdue.length}`}
              icon={BellRing}
              accent="text-red-600"
            >
              <div className="space-y-2">
                {byBucket.overdue.map((l) => (
                  <FollowUpCard
                    key={l.id}
                    lead={l}
                    bucket="overdue"
                    onAdvance={handleAdvance}
                    onSnooze={handleSnooze}
                    busy={busyId === l.id}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Hoy */}
          {byBucket.today.length > 0 && (
            <Section title={`Hoy — ${byBucket.today.length}`} icon={SunMedium} accent="text-amber-700">
              <div className="space-y-2">
                {byBucket.today.map((l) => (
                  <FollowUpCard
                    key={l.id}
                    lead={l}
                    bucket="today"
                    onAdvance={handleAdvance}
                    onSnooze={handleSnooze}
                    busy={busyId === l.id}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Próximos 7 días */}
          {byBucket.upcoming.length > 0 && (
            <Section
              title={`Próximos 7 días — ${byBucket.upcoming.length}`}
              icon={CalendarDays}
              accent="text-surface-500"
            >
              <div className="space-y-2">
                {byBucket.upcoming.map((l) => (
                  <FollowUpCard
                    key={l.id}
                    lead={l}
                    bucket="upcoming"
                    onAdvance={handleAdvance}
                    onSnooze={handleSnooze}
                    busy={busyId === l.id}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </AppLayout>
  );
}
