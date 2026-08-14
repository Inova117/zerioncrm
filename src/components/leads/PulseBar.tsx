import { useMemo } from 'react';
import type { Lead } from '../../types';
import { totals } from '../../services/metricsService';
import { fmtMoney } from '../../lib/utils';

/** Compact "pulse" strip: the founder's at-a-glance numbers above the board. */
export function PulseBar({ leads }: { leads: Lead[] }) {
  const t = useMemo(() => totals(leads), [leads]);

  const items = [
    { label: 'Contactadas', value: String(t.contactadas), dot: 'bg-frio' },
    { label: 'En contacto', value: String(t.enContacto), dot: 'bg-en-contacto' },
    { label: 'Demos enviadas', value: String(t.demos), dot: 'bg-demo-enviada' },
    { label: 'Negociando', value: String(t.negociando), dot: 'bg-negociando' },
    { label: 'Clientes', value: String(t.clientes), dot: 'bg-cliente' },
    { label: 'Pipeline', value: fmtMoney(t.pipelineValue), dot: 'bg-brand-500' },
    { label: 'MRR activo', value: t.mrrActive > 0 ? `${fmtMoney(t.mrrActive)}/mes` : '—', dot: 'bg-emerald-500' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${it.dot}`} />
          <span className="text-sm font-semibold text-surface-800">{it.value}</span>
          <span className="text-xs text-surface-400">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
