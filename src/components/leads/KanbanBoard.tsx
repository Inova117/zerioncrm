import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Lead, Temperature, User } from '../../types';
import { BOARD_STAGES } from '../../lib/constants';
import { KanbanColumn } from './KanbanColumn';
import { LeadCard } from './LeadCard';

interface KanbanBoardProps {
  leads: Lead[];
  users: User[];
  onOpenLead: (lead: Lead) => void;
  onMove: (leadId: string, to: Temperature) => void;
}

export function KanbanBoard({ leads, users, onOpenLead, onMove }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const byStage = useMemo(() => {
    const map = new Map<Temperature, Lead[]>();
    BOARD_STAGES.forEach((s) => map.set(s, []));
    leads.forEach((l) => {
      if (map.has(l.temperature)) map.get(l.temperature)!.push(l);
    });
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [leads]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const leadId = String(active.id);
    const to = over.id as Temperature;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && BOARD_STAGES.includes(to) && lead.temperature !== to) {
      onMove(leadId, to);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto px-4 pb-4 pt-1 sm:px-6">
        {BOARD_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            temperature={stage}
            leads={byStage.get(stage) ?? []}
            usersById={usersById}
            onOpenLead={onOpenLead}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-72">
            <LeadCard
              lead={activeLead}
              owner={usersById.get(activeLead.assignedTo)}
              onOpen={() => {}}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
