import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Lead, Temperature, User } from '../../types';
import { stageConfig } from '../../lib/constants';
import { cn, fmtCompact } from '../../lib/utils';
import { LeadCard } from './LeadCard';

interface KanbanColumnProps {
  temperature: Temperature;
  leads: Lead[];
  usersById: Map<string, User>;
  onOpenLead: (lead: Lead) => void;
}

export function KanbanColumn({ temperature, leads, usersById, onOpenLead }: KanbanColumnProps) {
  const s = stageConfig(temperature);
  const { setNodeRef, isOver } = useDroppable({ id: temperature, data: { type: 'column' } });
  const total = leads.reduce((sum, l) => sum + l.value, 0);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />
          <span className="text-sm font-semibold text-surface-800">{s.label}</span>
          <span className="rounded-full bg-surface-200 px-1.5 text-xs font-medium text-surface-600">
            {leads.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[11px] font-medium text-surface-400">${fmtCompact(total)}</span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto rounded-xl border-2 border-dashed p-2 transition-colors',
          isOver ? cn(s.ring, s.soft) : 'border-transparent'
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              owner={usersById.get(lead.assignedTo)}
              onOpen={onOpenLead}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg py-6 text-center text-xs text-surface-300">
            Suelta aquí
          </div>
        )}
      </div>
    </div>
  );
}
