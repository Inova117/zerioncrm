import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Building2 } from 'lucide-react';
import type { Lead, User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { TemperatureBadge } from '../ui/TemperatureBadge';
import { EmptyState } from '../ui/misc';
import { STAGES, sourceLabel, serviceLabel } from '../../lib/constants';
import {
  cn,
  colorFromString,
  initials,
  fmtMoney,
  fromNow,
  followUpLevel,
} from '../../lib/utils';

type SortKey = 'company' | 'temperature' | 'value' | 'lastContact';
const stageRank = (t: Lead['temperature']) => STAGES.findIndex((s) => s.key === t);

interface LeadsTableProps {
  leads: Lead[];
  usersById: Map<string, User>;
  onOpenLead: (lead: Lead) => void;
}

export function LeadsTable({ leads, usersById, onOpenLead }: LeadsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'lastContact', dir: -1 });

  const sorted = useMemo(() => {
    const arr = [...leads];
    arr.sort((a, b) => {
      let d = 0;
      if (sort.key === 'company') d = a.company.localeCompare(b.company);
      else if (sort.key === 'temperature') d = stageRank(a.temperature) - stageRank(b.temperature);
      else if (sort.key === 'value') d = a.value - b.value;
      else d = (a.lastContactAt ?? '').localeCompare(b.lastContactAt ?? '');
      return d * sort.dir;
    });
    return arr;
  }, [leads, sort]);

  if (leads.length === 0) {
    return (
      <div className="px-4 sm:px-6">
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="Sin resultados"
          description="Ningún prospecto coincide con los filtros actuales."
        />
      </div>
    );
  }

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn('px-3 py-2 font-medium', className)}>
      <button onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-surface-700">
        {children}
        {sort.key === k &&
          (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="px-4 pb-4 sm:px-6">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-400">
              <Th k="company">Empresa</Th>
              <Th k="temperature">Etapa</Th>
              <th className="px-3 py-2 font-medium">Servicio</th>
              <Th k="value" className="text-right">
                Valor
              </Th>
              <th className="px-3 py-2 font-medium">Fuente</th>
              <th className="px-3 py-2 font-medium">Responsable</th>
              <Th k="lastContact">Últ. contacto</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => {
              const owner = usersById.get(lead.assignedTo);
              const closed = lead.temperature === 'cliente' || lead.temperature === 'perdido';
              const fu = followUpLevel(lead.lastContactAt);
              const fuText = fu === 'stale' ? 'text-red-500' : fu === 'due' ? 'text-amber-600' : 'text-surface-500';
              return (
                <tr
                  key={lead.id}
                  onClick={() => onOpenLead(lead)}
                  className="cursor-pointer border-b border-surface-100 last:border-0 hover:bg-surface-50"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                        style={{ backgroundColor: colorFromString(lead.company || '?') }}
                      >
                        {initials(lead.company) || '·'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-surface-800">{lead.company}</p>
                        <p className="truncate text-xs text-surface-400">
                          {lead.contactName || 'Sin contacto'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <TemperatureBadge temperature={lead.temperature} />
                  </td>
                  <td className="px-3 py-2.5 text-surface-500">{serviceLabel(lead.service)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-medium text-surface-700">{fmtMoney(lead.value)}</div>
                    {lead.mrr > 0 && (
                      <div className="text-[11px] font-medium text-emerald-600">
                        {fmtMoney(lead.mrr)}/mes
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-surface-500">{sourceLabel(lead.source)}</td>
                  <td className="px-3 py-2.5">
                    {owner ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={owner.name} color={owner.avatarColor} size="sm" />
                        <span className="truncate text-surface-600">{owner.name.split(' ')[0]}</span>
                      </div>
                    ) : (
                      <span className="text-surface-400">—</span>
                    )}
                  </td>
                  <td className={cn('whitespace-nowrap px-3 py-2.5 text-xs', closed ? 'text-surface-400' : fuText)}>
                    {fromNow(lead.lastContactAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
