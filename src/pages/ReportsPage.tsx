import { useMemo } from 'react';
import { DollarSign, Repeat, Trophy, Receipt, Layers } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { StatCard } from '../components/dashboard/StatCard';
import { PageLoader, EmptyState } from '../components/ui/misc';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { totals, byService, winRate, avgTicket, pipelineByStage } from '../services/metricsService';
import { stageConfig } from '../lib/constants';
import { fmtMoney, cn } from '../lib/utils';

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
              style={{ width: `${Math.max(6, (r.value / max) * 100)}%`, backgroundColor: r.color }}
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
  const { loading, leads } = useData();

  const scoped = useMemo(
    () => (isAdmin ? leads : leads.filter((l) => l.assignedTo === user?.id)),
    [leads, isAdmin, user]
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
              value={`${wr}%`}
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
        </div>
      )}
    </AppLayout>
  );
}
