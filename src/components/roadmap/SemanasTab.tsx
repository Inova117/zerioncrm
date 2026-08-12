import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RoadmapDay } from '../../types';
import { weeklyRollups } from '../../lib/roadmapCalc';
import { fmtMoney, cn } from '../../lib/utils';

interface SemanasTabProps {
  days: RoadmapDay[];
}

const fmtShort = (d: string) => format(parseISO(d), 'd MMM', { locale: es });

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 4px 12px -2px rgb(15 23 42 / 0.1)',
};

function WeekChart({
  title,
  data,
  bars,
}: {
  title: string;
  data: Record<string, string | number>[];
  bars: { key: string; color: string; label: string }[];
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-800">{title}</h3>
        <div className="flex gap-3">
          {bars.map((b) => (
            <span key={b.key} className="flex items-center gap-1.5 text-[11px] text-surface-500">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#0f172a', fontWeight: 600 }}
            />
            {bars.map((b) => (
              <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[4, 4, 0, 0]} barSize={14} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Semanas: tabla de 12 semanas (OBJ vs REAL) + gráficos. Todo sale del diario. */
export function SemanasTab({ days }: SemanasTabProps) {
  const weekly = weeklyRollups(days);
  const totalsRow = weekly.reduce(
    (acc, w) => ({
      contactsObj: acc.contactsObj + w.contactsObj,
      contactsReal: acc.contactsReal + w.contactsReal,
      demosObj: acc.demosObj + w.demosObj,
      demosReal: acc.demosReal + w.demosReal,
      webs: acc.webs + w.webs,
      aaas: acc.aaas + w.aaas,
      income: acc.income + w.income,
    }),
    { contactsObj: 0, contactsReal: 0, demosObj: 0, demosReal: 0, webs: 0, aaas: 0, income: 0 }
  );

  const chartData = weekly.map((w) => ({
    name: `S${w.week}`,
    'objetivo contactos': w.contactsObj,
    'contactos reales': w.contactsReal,
    'objetivo demos': w.demosObj,
    'demos reales': w.demosReal,
  }));
  const incomeData = weekly.map((w) => ({ name: `S${w.week}`, ingreso: w.income }));

  const pctCell = (real: number, obj: number) => (
    <span
      className={cn(
        'inline-block min-w-[3rem] rounded-full px-2 py-0.5 text-xs font-semibold',
        obj === 0
          ? 'bg-surface-100 text-surface-400'
          : real >= obj
            ? 'bg-emerald-50 text-emerald-700'
            : real > 0
              ? 'bg-amber-50 text-amber-700'
              : 'bg-surface-100 text-surface-400'
      )}
    >
      {obj > 0 ? Math.round((real / obj) * 100) : 0}%
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <WeekChart
          title="Contactos por semana"
          data={chartData}
          bars={[
            { key: 'objetivo contactos', color: '#cbd5e1', label: 'Objetivo' },
            { key: 'contactos reales', color: '#6366f1', label: 'Real' },
          ]}
        />
        <WeekChart
          title="Demos por semana"
          data={chartData}
          bars={[
            { key: 'objetivo demos', color: '#cbd5e1', label: 'Objetivo' },
            { key: 'demos reales', color: '#8b5cf6', label: 'Real' },
          ]}
        />
      </div>

      <div className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-surface-800">Ingreso por semana</h3>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={incomeData} margin={{ left: -14, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                formatter={(v) => [fmtMoney(Number(v)), 'Ingreso']}
              />
              <Line type="monotone" dataKey="ingreso" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className="card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-surface-800">Tabla de las 12 semanas</h2>
          <p className="text-xs text-surface-400">El real sale del diario; el objetivo, de tu meta diaria (15 contactos, 3/2/1 demos).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
                <th className="py-2 pr-3">Sem</th>
                <th className="py-2 pr-3">Rango</th>
                <th className="py-2 pr-3 text-right">Contactos OBJ</th>
                <th className="py-2 pr-3 text-right">REAL</th>
                <th className="py-2 pr-3 text-right">%</th>
                <th className="py-2 pr-3 text-right">Demos OBJ</th>
                <th className="py-2 pr-3 text-right">REAL</th>
                <th className="py-2 pr-3 text-right">%</th>
                <th className="py-2 pr-3 text-right">Webs</th>
                <th className="py-2 pr-3 text-right">AaaS</th>
                <th className="py-2 pr-3 text-right">Ingreso</th>
                <th className="py-2 text-right">Close web</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.week} className="border-b border-surface-100">
                  <td className="py-2 pr-3 font-semibold text-surface-700">{w.week}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-surface-500">
                    {fmtShort(w.desde)} – {fmtShort(w.hasta)}
                  </td>
                  <td className="py-2 pr-3 text-right text-surface-500">{w.contactsObj}</td>
                  <td className={cn('py-2 pr-3 text-right font-medium', w.contactsReal > 0 ? 'text-surface-800' : 'text-surface-300')}>
                    {w.contactsReal}
                  </td>
                  <td className="py-2 pr-3 text-right">{pctCell(w.contactsReal, w.contactsObj)}</td>
                  <td className="py-2 pr-3 text-right text-surface-500">{w.demosObj}</td>
                  <td className={cn('py-2 pr-3 text-right font-medium', w.demosReal > 0 ? 'text-surface-800' : 'text-surface-300')}>
                    {w.demosReal}
                  </td>
                  <td className="py-2 pr-3 text-right">{pctCell(w.demosReal, w.demosObj)}</td>
                  <td className="py-2 pr-3 text-right text-surface-600">{w.webs}</td>
                  <td className="py-2 pr-3 text-right text-surface-600">{w.aaas}</td>
                  <td className="py-2 pr-3 text-right text-surface-600">{fmtMoney(w.income)}</td>
                  <td className="py-2 text-right text-surface-600">
                    {w.demosReal > 0 ? `${Math.round(w.closeWeb * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-50 font-semibold text-surface-800">
                <td className="py-2.5 pr-3" colSpan={2}>TOTAL</td>
                <td className="py-2.5 pr-3 text-right">{totalsRow.contactsObj}</td>
                <td className="py-2.5 pr-3 text-right">{totalsRow.contactsReal}</td>
                <td className="py-2.5 pr-3 text-right">{pctCell(totalsRow.contactsReal, totalsRow.contactsObj)}</td>
                <td className="py-2.5 pr-3 text-right">{totalsRow.demosObj}</td>
                <td className="py-2.5 pr-3 text-right">{totalsRow.demosReal}</td>
                <td className="py-2.5 pr-3 text-right">{pctCell(totalsRow.demosReal, totalsRow.demosObj)}</td>
                <td className="py-2.5 pr-3 text-right">{totalsRow.webs}</td>
                <td className="py-2.5 pr-3 text-right">{totalsRow.aaas}</td>
                <td className="py-2.5 pr-3 text-right">{fmtMoney(totalsRow.income)}</td>
                <td className="py-2.5 text-right">
                  {totalsRow.demosReal > 0 ? `${Math.round((totalsRow.webs / totalsRow.demosReal) * 100)}%` : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
