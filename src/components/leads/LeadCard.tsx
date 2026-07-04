import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Building2, Calendar, GripVertical } from 'lucide-react';
import type { Lead, User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { sourceLabel } from '../../lib/constants';
import { cn, fmtMoney, fromNow } from '../../lib/utils';

interface LeadCardProps {
  lead: Lead;
  owner?: User;
  onOpen: (lead: Lead) => void;
  overlay?: boolean;
}

export function LeadCard({ lead, owner, onOpen, overlay }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { from: lead.temperature },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Whole card is the drag handle (distance activation lets plain clicks through).
      {...attributes}
      {...listeners}
      className={cn(
        'group card touch-none cursor-grab select-none p-3 transition-shadow hover:shadow-card-hover active:cursor-grabbing',
        isDragging && 'opacity-40',
        overlay && 'rotate-2 shadow-pop'
      )}
      onClick={() => !overlay && onOpen(lead)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-surface-300 opacity-0 transition-opacity group-hover:opacity-100" />
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
    </div>
  );
}
