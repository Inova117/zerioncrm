import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Lead, Temperature, User } from '../../types';
import { stageConfig } from '../../lib/constants';
import { cn, fmtCompact } from '../../lib/utils';
import { LeadCard } from './LeadCard';

interface KanbanColumnProps {
  temperature: Temperature;
  leads: Lead[];
  usersById: Map<string, User>;
  commentCounts: Record<string, number>;
  onOpenLead: (lead: Lead) => void;
  onQuickAdd: (temperature: Temperature, company: string) => void;
}

export function KanbanColumn({
  temperature,
  leads,
  usersById,
  commentCounts,
  onOpenLead,
  onQuickAdd,
}: KanbanColumnProps) {
  const s = stageConfig(temperature);
  const { setNodeRef, isOver } = useDroppable({ id: temperature, data: { type: 'column' } });
  const total = leads.reduce((sum, l) => sum + l.value, 0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const company = draft.trim();
    if (!company) return;
    onQuickAdd(temperature, company);
    setDraft(''); // keep open for rapid entry
  }

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
              commentCount={commentCounts[lead.id]}
              onOpen={onOpenLead}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && !adding && (
          <div className="flex flex-1 items-center justify-center rounded-lg py-6 text-center text-xs text-surface-300">
            Suelta o añade aquí
          </div>
        )}

        {/* Quick add */}
        {adding ? (
          <form onSubmit={submitQuickAdd} className="rounded-lg border border-brand-200 bg-white p-2 shadow-sm">
            <input
              autoFocus
              className="input py-1.5 text-sm"
              placeholder="Nombre de la empresa…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (setAdding(false), setDraft(''))}
              onBlur={() => !draft && setAdding(false)}
            />
            <div className="mt-1.5 flex items-center gap-1.5">
              <button type="submit" className="btn-primary px-2.5 py-1 text-xs">
                Añadir
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => {
                  setAdding(false);
                  setDraft('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-300 py-2 text-xs font-medium text-surface-400 transition-colors hover:border-brand-400 hover:bg-white hover:text-brand-600"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir
          </button>
        )}
      </div>
    </div>
  );
}
