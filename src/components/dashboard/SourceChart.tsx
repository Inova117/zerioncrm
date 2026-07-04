import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import type { Lead } from '../../types';
import { bySource } from '../../services/metricsService';
import { sourceLabel } from '../../lib/constants';

const PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#14b8a6', '#ef4444', '#64748b'];

export function SourceChart({ leads }: { leads: Lead[] }) {
  const data = bySource(leads)
    .map((d) => ({ name: sourceLabel(d.source as never), count: d.count }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-surface-400">Sin datos aún.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={78}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: '#64748b' }}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              boxShadow: '0 4px 12px -2px rgb(15 23 42 / 0.1)',
            }}
            formatter={(v) => [`${v} prospectos`, '']}
            labelStyle={{ color: '#0f172a', fontWeight: 600 }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
