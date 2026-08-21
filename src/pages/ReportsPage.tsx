import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Repeat, Trophy, Receipt, Layers, BellRing, ClipboardList, ArrowRight, Loader2 } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { StatCard } from '../components/dashboard/StatCard';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { totals, byService, winRate, avgTicket, pipelineByStage } from '../services/metricsService';
import { stageConfig } from '../lib/constants';
import { fmtMoney, fmtDateTime, cn } from '../lib/utils';
import { followUpBucket, touchInfo } from '../lib/followUp';
import { useNichePerformance } from '../hooks/useNichePerformance';
import type { NichePerformance } from '../lib/feedback';
import { dailyActivityService } from '../services/dailyActivityService';
import type { DailyActivity } from '../types';
import { dayKey, weekDays, activityTotals } from '../lib/dailyActivityUtils';
import type { Lead } from '../types';

/** Horizontal labelled bars (reused for revenue-by-service and pipeline-by-stage). */
function Bars({
  rows,
}: {
  rows: { label: string; value: number; color: string; display: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.every((r) => r.value === 0)) {
    return <p className="py-4 text-center text-sm text-surface-400">Aún no hay datos.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs font-medium text-surface-600">{r.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-lg bg-surface-100">
            <div
              className="flex h-full items-center justify-end rounded-lg px-2 text-[11px] font-semibold text-white transition-all"
              style={{
                width: r.value === 0 ? '0%' : `${Math.max(6, (r.value / max) * 100)}%`,
                backgroundColor: r.color,
              }}
            >
              {r.value > 0 && r.display}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const { user, isAdmin } = useAuth();
  const { loading, leads: allLeads } = useData();

  const scoped = useMemo(
    () => (isAdmin ? allLeads : allLeads.filter((l) => l.assignedTo === user?.id)),
    [allLeads, isAdmin, user]
  );

  const t = useMemo(() => totals(scoped), [scoped]);
  const services = useMemo(() => byService(scoped), [scoped]);
  const wr = useMemo(() => winRate(scoped), [scoped]);
  const ticket = useMemo(() => avgTicket(scoped), [scoped]);
  const pipeline = useMemo(() => pipelineByStage(scoped), [scoped]);

  if (!user) return null;

  return (
    <AppLayout title="Reportes" subtitle="Rendimiento de la agencia: ingresos, servicios y conversión.">
      {loading ? (
        <PageLoader />
      ) : scoped.length === 0 ? (
        <EmptyState title="Sin datos aún" description="Cuando cierres oportunidades, verás tus reportes aquí." />
      ) : (
        <div className="space-y-5">
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Valor ganado"
              value={fmtMoney(t.wonValue)}
              hint="Proyectos cerrados"
              icon={<DollarSign className="h-4 w-4" />}
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              label="MRR activo"
              value={t.mrrActive > 0 ? `${fmtMoney(t.mrrActive)}/mes` : '—'}
              hint="Retainers de clientes"
              icon={<Repeat className="h-4 w-4" />}
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              label="Tasa de cierre"
              value={t.clientes + t.perdidos > 0 ? `${wr}%` : '—'}
              hint={`${t.clientes} ganados · ${t.perdidos} perdidos`}
              icon={<Trophy className="h-4 w-4" />}
            />
            <StatCard
              label="Ticket promedio"
              value={fmtMoney(ticket)}
              hint="Por proyecto ganado"
              icon={<Receipt className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Revenue by service line */}
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand-600" />
                <div>
                  <h2 className="text-sm font-semibold text-surface-800">Ingresos ganados por servicio</h2>
                  <p className="text-xs text-surface-400">Qué líneas te dan más dinero.</p>
                </div>
              </div>
              <Bars
                rows={services.map((s, i) => ({
                  label: s.label,
                  value: s.wonValue,
                  display: fmtMoney(s.wonValue),
                  color: ['#4f46e5', '#7c3aed', '#db2777', '#f59e0b', '#10b981', '#3b82f6', '#14b8a6', '#64748b'][i % 8],
                }))}
              />
            </div>

            {/* Pipeline value by stage */}
            <div className="card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-surface-800">Valor en pipeline por etapa</h2>
                <p className="text-xs text-surface-400">Dónde está el dinero por cerrar.</p>
              </div>
              <Bars
                rows={pipeline.map((p) => ({
                  label: stageConfig(p.temperature).label,
                  value: p.value,
                  display: fmtMoney(p.value),
                  color: stageConfig(p.temperature).color,
                }))}
              />
            </div>
          </div>

          {/* Service detail table */}
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-surface-800">Detalle por línea de servicio</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
                    <th className="px-2 py-2 font-medium">Servicio</th>
                    <th className="px-2 py-2 text-center font-medium">Oport.</th>
                    <th className="px-2 py-2 text-center font-medium">Ganados</th>
                    <th className="px-2 py-2 text-right font-medium">Valor ganado</th>
                    <th className="px-2 py-2 text-right font-medium">MRR</th>
                    <th className="px-2 py-2 text-right font-medium">En pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.service} className="border-b border-surface-100 last:border-0">
                      <td className="px-2 py-2.5 font-medium text-surface-800">{s.label}</td>
                      <td className="px-2 py-2.5 text-center text-surface-600">{s.deals}</td>
                      <td className={cn('px-2 py-2.5 text-center', s.won > 0 ? 'text-emerald-600' : 'text-surface-400')}>
                        {s.won}
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium text-surface-700">{fmtMoney(s.wonValue)}</td>
                      <td className="px-2 py-2.5 text-right text-emerald-600">
                        {s.mrr > 0 ? `${fmtMoney(s.mrr)}/mes` : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-surface-500">{fmtMoney(s.openValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seguimiento: salud de la cola de toques (conectado con Hoy) */}
          <FollowUpPanel leads={scoped} />

          {/* Actividad diaria del equipo (conectado con Actividad) */}
          <TeamActivityPanel />

          {/* Feedback loop: rendimiento por nicho (qué convierte de verdad) */}
          <NichePerformancePanel />
        </div>
      )}
    </AppLayout>
  );
}

function NichePerformancePanel() {
  const perf = useNichePerformance();
  if (!perf.length) return null;
  const sorted = [...perf].sort((a, b) => b.priority - a.priority);
  const badge = (p: NichePerformance['primary']) =>
    p === 'aaas' ? 'AI Agent' : p === 'web' ? 'Web' : 'Mixto';

  return (
    <div className="card p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-surface-800">Rendimiento por nicho (se aprende solo)</h2>
        <p className="text-xs text-surface-400">
          Qué nichos convierten de verdad, según las etapas y objeciones que registras. Con pocos datos arranca neutral (50) y se ajusta con el tiempo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
              <th className="px-2 py-2 font-medium">Nicho</th>
              <th className="px-2 py-2 font-medium">Servicio</th>
              <th className="px-2 py-2 text-center font-medium">Leads</th>
              <th className="px-2 py-2 text-center font-medium">Contactados</th>
              <th className="px-2 py-2 text-center font-medium">Demos</th>
              <th className="px-2 py-2 text-center font-medium">Cierre</th>
              <th className="px-2 py-2 text-right font-medium">Prioridad</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.niche} className="border-b border-surface-100 last:border-0">
                <td className="px-2 py-2.5 font-medium text-surface-800">{p.label}</td>
                <td className="px-2 py-2.5">
                  <span className={cn(
                    'badge text-[11px]',
                    p.primary === 'aaas' ? 'bg-violet-50 text-violet-600' : p.primary === 'web' ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-surface-600'
                  )}>
                    {badge(p.primary)}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center text-surface-600">{p.leads}</td>
                <td className="px-2 py-2.5 text-center text-surface-600">{p.contacted}</td>
                <td className="px-2 py-2.5 text-center text-surface-600">{p.demos}</td>
                <td className="px-2 py-2.5 text-center text-surface-600">
                  {p.demos > 0 ? `${Math.round(p.closeRate * 100)}%` : '—'}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${p.priority}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold tabular-nums text-surface-700">
                      {Math.round(p.priority)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Salud de la cola de seguimiento: cuántos toques caen en cada cubo y cuáles
 *  están atrasados (conexión automática con la vista Hoy). */
function FollowUpPanel({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let withNext = 0;
    const weekFromNow = Date.now() + 7 * 86_400_000;
    for (const l of leads) {
      const b = followUpBucket(l.nextActionAt);
      if (b === 'overdue') overdue += 1;
      else if (b === 'today') today += 1;
      else if (
        b === 'upcoming' &&
        l.nextActionAt &&
        new Date(l.nextActionAt).getTime() <= weekFromNow
      ) {
        upcoming += 1;
      }
      if (l.nextActionAt) withNext += 1;
    }
    const open = leads.filter(
      (l) => !['cliente', 'perdido'].includes(l.temperature)
    ).length;
    return { overdue, today, upcoming, withNext, total: open };
  }, [leads]);

  const topOverdue = useMemo(
    () =>
      leads
        .filter((l) => followUpBucket(l.nextActionAt) === 'overdue')
        .sort((a, b) => (a.nextActionAt ?? '').localeCompare(b.nextActionAt ?? ''))
        .slice(0, 5),
    [leads]
  );

  if (stats.total === 0) return null;

  const coverage = stats.total > 0 ? Math.round((stats.withNext / stats.total) * 100) : 0;
  const chip = (label: string, value: number, tone: 'red' | 'amber' | 'gray' | 'green') => (
    <div className="flex flex-col rounded-xl border border-surface-200 bg-white px-3 py-2">
      <span
        className={cn(
          'text-xl font-bold tabular-nums',
          tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-surface-700'
        )}
      >
        {value}
      </span>
      <span className="text-[11px] text-surface-400">{label}</span>
    </div>
  );

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-brand-600" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-surface-800">Seguimiento — salud de la cola</h2>
          <p className="text-xs text-surface-400">
            Los toques con fecha vencida o de hoy son lo que ves en la vista Hoy.
          </p>
        </div>
        <Link to="/hoy" className="btn-secondary px-3 py-1.5 text-xs">
          Abrir Hoy <ArrowRight className="ml-1 inline h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chip('Atrasados', stats.overdue, 'red')}
        {chip('Para hoy', stats.today, 'amber')}
        {chip('Próximos 7 días', stats.upcoming, 'gray')}
        {chip(`Con próxima acción (${coverage}%)`, stats.withNext, 'green')}
      </div>

      {topOverdue.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wide text-surface-400">
                <th className="px-2 py-2 font-medium">Prospecto</th>
                <th className="px-2 py-2 text-center font-medium">Toque</th>
                <th className="px-2 py-2 text-right font-medium">Vencido desde</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {topOverdue.map((l) => {
                const t = touchInfo(l);
                return (
                  <tr key={l.id} className="border-b border-surface-100 last:border-0">
                    <td className="px-2 py-2.5 font-medium text-surface-800">{l.company}</td>
                    <td className="px-2 py-2.5 text-center text-surface-600">
                      {t ? `${t.touch}/${t.total > 0 ? t.total : '∞'}` : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right text-red-600">
                      {fmtDateTime(l.nextActionAt)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Link
                        to={`/leads?lead=${l.id}`}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Ver prospecto →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Actividad diaria del equipo en la semana actual (conexión con Actividad):
 *  lo que cada vendedor registró, sin depender del tab Actividad. */
function TeamActivityPanel() {
  const { isAdmin } = useAuth();
  const { users } = useData();
  const [rows, setRows] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const activeEmployees = useMemo(
    () => users.filter((u) => u.role === 'employee' && u.active),
    [users]
  );
  const week = useMemo(() => weekDays(new Date()), []);
  const weekFrom = dayKey(week[0]!);
  const weekTo = dayKey(week[4]!);

  useEffect(() => {
    if (!isAdmin || activeEmployees.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    dailyActivityService
      .listRange(
        activeEmployees.map((u) => u.id),
        weekFrom,
        weekTo
      )
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [isAdmin, activeEmployees, weekFrom, weekTo]);

  if (!isAdmin || activeEmployees.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-brand-600" />
        <div>
          <h2 className="text-sm font-semibold text-surface-800">Actividad del equipo — esta semana</h2>
          <p className="text-xs text-surface-400">
            Lo que cada vendedor registró en su check-in diario (tab Actividad).
          </p>
        </div>
      </div>
      {loading ? (
        <div className="flex h-24 items-center justify-center text-surface-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wide text-surface-400">
                <th className="pb-2 pr-2 font-medium">Vendedor</th>
                <th className="pb-2 pr-2 text-center font-medium">Llamadas</th>
                <th className="pb-2 pr-2 text-center font-medium">Contactos</th>
                <th className="pb-2 pr-2 text-center font-medium">Demos</th>
                <th className="pb-2 pr-2 text-center font-medium">Cierres</th>
                <th className="pb-2 pr-2 text-center font-medium">Demo→cierre</th>
                <th className="pb-2 text-center font-medium">Registro</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((u) => {
                const t = activityTotals(rows.filter((r) => r.userId === u.id));
                return (
                  <tr key={u.id} className="border-t border-surface-100">
                    <td className="py-2 pr-2 font-medium text-surface-800">
                      <Link to={`/actividad?u=${u.id}`} className="hover:text-brand-600 hover:underline">
                        {u.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-center text-surface-700">{t.calls}</td>
                    <td className="py-2 pr-2 text-center text-surface-700">{t.contacts}</td>
                    <td className="py-2 pr-2 text-center text-surface-700">{t.demos}</td>
                    <td className="py-2 pr-2 text-center font-semibold text-emerald-700">{t.closes}</td>
                    <td className="py-2 pr-2 text-center text-surface-500">{t.closeRate}%</td>
                    <td className="py-2 pr-2 text-center text-surface-500">{t.daysLogged}/5</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
