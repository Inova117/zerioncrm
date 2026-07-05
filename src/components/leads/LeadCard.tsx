import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, Calendar, GripVertical } from 'lucide-react';
import type { Lead, User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { sourceLabel } from '../../lib/constants';
import { cn, fmtMoney, fromNow } from '../../lib/utils';

/** Pure presentation — shared by the sortable card and the drag overlay. */
function CardBody({ lead, owner, grip }: { lead: Lead; owner?: User; grip?: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <GripVertical
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-surface-300 transition-opacity',
              grip ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
            )}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-surface-900">{lead.company}</p>
            <p className="truncate text-xs text-surface-500">
              {lead.contactName}
              {lead.role ? ` · ${lead.role}` : ''}
            </p>
          </div>
        </div>
        {lead.value > 0 && (
          <span className="shrink-0 rounded-md bg-surface-100 px-1.5 py-0.5 text-[11px] font-semibold text-surface-600">
            {fmtMoney(lead.value)}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {lead.industry && (
          <span className="badge bg-brand-50 text-brand-600">
            <Building2 className="h-3 w-3" />
            {lead.industry}
          </span>
        )}
        <span className="badge bg-surface-100 text-surface-500">{sourceLabel(lead.source)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-surface-100 pt-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-surface-400">
          <Calendar className="h-3.5 w-3.5" />
          {fromNow(lead.lastContactAt)}
        </div>
        {owner && <Avatar name={owner.name} color={owner.avatarColor} size="sm" />}
      </div>
    </>
  );
}

interface LeadCardProps {
  lead: Lead;
  owner?: User;
  onOpen: (lead: Lead) => void;
}

/** Sortable card — draggable within and across columns; keyboard-accessible. */
export function LeadCard({ lead, owner, onOpen }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'lead', temperature: lead.temperature },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group card touch-none cursor-grab select-none p-3 transition-shadow hover:shadow-card-hover active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
      onClick={() => onOpen(lead)}
    >
      <CardBody lead={lead} owner={owner} grip />
    </div>
  );
}

/** Non-interactive clone shown under the pointer while dragging. */
export function LeadCardOverlay({ lead, owner }: { lead: Lead; owner?: User }) {
  return (
    <div className="card rotate-2 p-3 shadow-pop">
      <CardBody lead={lead} owner={owner} />
    </div>
  );
}
