import { useEffect, useMemo, useRef, useState } from 'react';
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
  /** Atomic: change stage (if the column changed) + persist the target column order. */
  onCommit: (leadId: string, toTemperature: Temperature, orderedVisibleIds: string[]) => void;
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

export function KanbanBoard({ leads, users, onOpenLead, onCommit }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Columns>(() => buildColumns(leads));
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragging = useRef(false);

  // Resync board grouping whenever the underlying leads change (create, filter,
  // committed drag, etc.) — but never mid-drag, or it would clobber the live
  // reparent state. (bug #13)
  useEffect(() => {
    if (dragging.current) return;
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
    dragging.current = true;
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
    dragging.current = false;
    setActiveId(null);
    if (!over) {
      setColumns(buildColumns(leads)); // no drop target → undo any reparent
      return;
    }
    const draggedId = String(active.id);
    const overId = String(over.id);
    const container = findContainer(draggedId); // where it ended up after onDragOver
    if (!container) return;

    let finalColumns = columns;
    const items = columns[container];
    const activeIndex = items.indexOf(draggedId);
    const overIndex = overId in columns ? items.length - 1 : items.indexOf(overId);
    if (activeIndex !== overIndex && overIndex >= 0) {
      finalColumns = { ...columns, [container]: arrayMove(items, activeIndex, overIndex) };
      setColumns(finalColumns);
    }

    // One atomic persist (stage change if any + column order). No racing writes.
    onCommit(draggedId, container as Temperature, finalColumns[container]);
  }

  function onDragCancel() {
    dragging.current = false;
    setActiveId(null);
    setColumns(buildColumns(leads)); // undo the live reparent from onDragOver (bug #5)
  }

  const activeLead = activeId ? leadsById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
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
