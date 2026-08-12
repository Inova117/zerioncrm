import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  PhoneCall,
  Repeat,
  Rocket,
  Trophy,
} from 'lucide-react';
import type { RoadmapClient, RoadmapDay, RoadmapMeta } from '../../types';
import { StatCard } from '../dashboard/StatCard';
import { computeKpis, monthlyRollups, totals } from '../../lib/roadmapCalc';
import type { KpiRow } from '../../lib/roadmapCalc';
import { fmtMoney, cn } from '../../lib/utils';

interface PanelTabProps {
  meta: RoadmapMeta;
  days: RoadmapDay[];
  clients: RoadmapClient[];
  saveMeta: (meta: RoadmapMeta) => Promise<void>;
}

/** Input de objetivo monetario que guarda al salir del campo. */
function MoneyGoalInput({ initial, onCommit }: { initial: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(initial));
  useEffect(() => setV(String(initial)), [initial]);
  return (
    <input
      type="number"
      min={0}
      className="input w-24 text-right"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onCommit(Math.max(0, Number(v) || 0))}
    />
  );
}

const fmtKpi = (r: KpiRow): string => {
  if (r.display === 'pct') return `${Math.round(r.value * 100)}%`;
  if (r.display === 'money') return fmtMoney(r.value);
  return String(Math.round(r.value));
};

const fmtKpiTarget = (r: KpiRow): string => {
  if (r.display === 'pct') return `${Math.round(r.target * 100)}%`;
  if (r.display === 'money') return fmtMoney(r.target);
  return String(r.target);
};

function KpiBadge({ r }: { r: KpiRow }) {
  const cfg = {
    ok: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    kill: 'bg-red-50 text-red-700',
    pending: 'bg-surface-100 text-surface-500',
  }[r.status];
  const label = {
    ok: '✓ Al día',
    warn: '⚠ Revisar',
    kill: '✕ KILL METRIC',
    pending: 'Sin datos',
  }[r.status];
  return <span className={cn('badge', cfg)}>{label}</span>;
}

/** Panel: resumen acumulado, metas mensuales editables y veredictos KPI. */
export function PanelTab({ meta, days, clients, saveMeta }: PanelTabProps) {
  const t = totals(days, clients);
  const kpis = computeKpis(days, clients, meta);
  const monthly = monthlyRollups(days, meta);
  const kills = kpis.filter((k) => k.status === 'kill');

  const commitGoal = (monthKey: string, field: 'income' | 'mrr', value: number) => {
    const current = meta.monthlyGoals[monthKey] ?? { income: 0, mrr: 0 };
    void saveMeta({
      ...meta,
      monthlyGoals: { ...meta.monthlyGoals, [monthKey]: { ...current, [field]: value } },
    });
  };

  const rate = (v: number) => (v > 0 ? `${Math.round(v * 100)}%` : '—');

  return (
    <div className="space-y-5">
      {/* Kill metrics disparadas */}
      {kills.length > 0 && (
        <div className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Kill metric disparada — para y corrige ANTES de gastar más tiempo o plata:
          </p>
          {kills.map((k) => (
            <p key={k.key} className="pl-6 text-sm text-red-600">
              {k.label}: {k.killText}
            </p>
          ))}
        </div>
      )}

      {/* Resumen acumulado */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Contactos hechos"
          value={t.contacts}
          hint={`Objetivo del trimestre: 1.230`}
          icon={<PhoneCall className="h-4 w-4" />}
        />
        <StatCard label="Demos mostradas" value={t.demos} icon={<Rocket className="h-4 w-4" />} accent="text-violet-600" accentBg="bg-violet-50" />
        <StatCard label="Webs vendidas" value={t.webs} hint={`$${t.webs * 200} en webs`} icon={<Trophy className="h-4 w-4" />} accent="text-emerald-600" accentBg="bg-emerald-50" />
        <StatCard label="AaaS vendidos" value={t.aaas} icon={<CheckCircle2 className="h-4 w-4" />} accent="text-amber-600" accentBg="bg-amber-50" />
        <StatCard
          label="Ingreso trimestre"
          value={fmtMoney(t.income)}
          hint="Sale solo del diario"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="MRR actual"
          value={t.mrrActive > 0 ? `${fmtMoney(t.mrrActive)}/mes` : '—'}
          hint="Clientes activos"
          icon={<Repeat className="h-4 w-4" />}
          accent="text-emerald-600"
          accentBg="bg-emerald-50"
        />
      </div>

      {/* Rates */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Close rate web', value: t.closeWeb, target: '≥20%' },
          { label: 'Close rate AaaS', value: t.closeAaaS, target: '≥10%' },
          { label: 'Upsell web → AaaS', value: t.upsell, target: '≥30%' },
        ].map((r) => (
          <div key={r.label} className="card p-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{r.label}</p>
            <p className="mt-1 text-xl font-semibold text-surface-900">{rate(r.value)}</p>
            <p className="text-[11px] text-surface-400">objetivo {r.target}</p>
          </div>
        ))}
      </div>

      {/* Metas mensuales */}
      <section className="card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-surface-800">Meta mensual (objetivo vs real)</h2>
          <p className="text-xs text-surface-400">Los objetivos son tuyos: edítalos y se guardan al salir del campo.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
                <th className="py-2 pr-3">Mes</th>
                <th className="py-2 pr-3 text-right">Ingreso objetivo</th>
                <th className="py-2 pr-3 text-right">Ingreso real</th>
                <th className="py-2 pr-3 text-right">Webs</th>
                <th className="py-2 pr-3 text-right">AaaS</th>
                <th className="py-2 pr-3 text-right">MRR objetivo</th>
                <th className="py-2 text-right">% cumplido</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.monthKey} className="border-b border-surface-100">
                  <td className="py-2.5 pr-3 font-medium text-surface-700">{m.label}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <MoneyGoalInput initial={m.incomeObj} onCommit={(v) => commitGoal(m.monthKey, 'income', v)} />
                  </td>
                  <td className={cn('py-2.5 pr-3 text-right font-medium', m.incomeReal > 0 ? 'text-surface-800' : 'text-surface-300')}>
                    {fmtMoney(m.incomeReal)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-surface-600">{m.webs}</td>
                  <td className="py-2.5 pr-3 text-right text-surface-600">{m.aaas}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <MoneyGoalInput initial={m.mrrObj} onCommit={(v) => commitGoal(m.monthKey, 'mrr', v)} />
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={cn(
                        'inline-block min-w-[3rem] rounded-full px-2 py-0.5 text-xs font-semibold',
                        m.pctIncome >= 100
                          ? 'bg-emerald-50 text-emerald-700'
                          : m.pctIncome > 0
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-surface-100 text-surface-400'
                      )}
                    >
                      {m.pctIncome}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* KPIs */}
      <section className="card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-surface-800">KPIs con kill metrics</h2>
          <p className="text-xs text-surface-400">
            Regla: un kill metric disparado 2 semanas seguidas = parar y corregir. Los valores salen solos del diario.
          </p>
        </div>
        <ul className="divide-y divide-surface-100">
          {kpis.map((k) => (
            <li key={k.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-surface-800">{k.label}</p>
                <p className="text-xs text-surface-400">
                  {k.killText ?? 'Sin kill metric'} · objetivo {fmtKpiTarget(k)}
                </p>
              </div>
              <p className="text-lg font-semibold text-surface-900">{fmtKpi(k)}</p>
              <KpiBadge r={k} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
