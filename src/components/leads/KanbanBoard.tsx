import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Lead, Temperature, User } from '../../types';
import { BOARD_STAGES } from '../../lib/constants';
import { KanbanColumn } from './KanbanColumn';
import { LeadCardOverlay } from './LeadCard';

type Columns = Record<string, string[]>;

interface KanbanBoardProps {
  leads: Lead[];
  users: User[];
  onOpenLead: (lead: Lead) => void;
  onMove: (leadId: string, to: Temperature) => void;
  onReorder: (orderedIds: string[]) => void;
}

function buildColumns(leads: Lead[]): Columns {
  const cols: Columns = {};
  BOARD_STAGES.forEach((s) => (cols[s] = []));
  [...leads]
    .sort((a, b) => a.position - b.position)
    .forEach((l) => {
      if (cols[l.temperature]) cols[l.temperature].push(l.id);
    });
  return cols;
}

export function KanbanBoard({ leads, users, onOpenLead, onMove, onReorder }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Columns>(() => buildColumns(leads));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Resync board grouping whenever the underlying leads change (create, filter,
  // move persisted, etc.). No drag is in flight at that point.
  useEffect(() => {
    setColumns(buildColumns(leads));
  }, [leads]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findContainer = (id: string): string | undefined => {
    if (id in columns) return id;
    return BOARD_STAGES.find((s) => columns[s]?.includes(id));
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  // Live-reparent a card as it hovers over a different column.
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const overIndex = overItems.indexOf(overId);
      const newIndex = overId in prev ? overItems.length : overIndex >= 0 ? overIndex : overItems.length;
      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== activeId),
        [overContainer]: [...overItems.slice(0, newIndex), activeId, ...overItems.slice(newIndex)],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const container = findContainer(activeId); // where it ended up after onDragOver
    if (!container) return;

    let finalColumns = columns;
    const items = columns[container];
    const activeIndex = items.indexOf(activeId);
    const overIndex = overId in columns ? items.length - 1 : items.indexOf(overId);
    if (activeIndex !== overIndex && overIndex >= 0) {
      finalColumns = { ...columns, [container]: arrayMove(items, activeIndex, overIndex) };
      setColumns(finalColumns);
    }

    // Persist: temperature change (if the column changed) + new ordering.
    const lead = leadsById.get(activeId);
    const targetTemp = container as Temperature;
    if (lead && lead.temperature !== targetTemp) onMove(activeId, targetTemp);
    onReorder(finalColumns[container]);
  }

  const activeLead = activeId ? leadsById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto px-4 pb-4 pt-1 sm:px-6">
        {BOARD_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            temperature={stage}
            leads={(columns[stage] ?? []).flatMap((id) => {
              const l = leadsById.get(id);
              return l ? [l] : [];
            })}
            usersById={usersById}
            onOpenLead={onOpenLead}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-72">
            <LeadCardOverlay lead={activeLead} owner={usersById.get(activeLead.assignedTo)} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
