import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, CalendarClock, MessageCircle, AlertCircle, Layers, Repeat, BellRing } from 'lucide-react';
import type { Lead, User } from '../../types';
import { Avatar } from '../ui/Avatar';
import { sourceLabel, serviceLabel, stageConfig } from '../../lib/constants';
import { followUpBucket, touchInfo } from '../../lib/followUp';
import { cn, fmtMoney, fmtDate, fromNow, colorFromString, initials, followUpLevel } from '../../lib/utils';

function CompanyAvatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
      style={{ backgroundColor: colorFromString(name || '?') }}
    >
      {initials(name) || <Building2 className="h-4 w-4" />}
    </span>
  );
}

/** Pure presentation — shared by the sortable card and the drag overlay. */
function CardBody({ lead, owner, commentCount = 0 }: { lead: Lead; owner?: User; commentCount?: number }) {
  const closed = lead.temperature === 'cliente' || lead.temperature === 'perdido' || lead.temperature === 'reactivacion';
  const fu = followUpLevel(lead.lastContactAt);
  const fuDot = fu === 'stale' ? 'bg-red-500' : fu === 'due' ? 'bg-amber-500' : 'bg-emerald-500';
  const fuText = fu === 'stale' ? 'text-red-500' : fu === 'due' ? 'text-amber-600' : 'text-surface-400';

  // Pipeline v2: el próximo toque con fecha manda — el semáforo de la tarjeta.
  const touch = touchInfo(lead);
  const bucket = followUpBucket(lead.nextActionAt);
  const fuBadge =
    !closed && touch && lead.nextActionAt
      ? cn(
          'badge',
          bucket === 'overdue'
            ? 'bg-red-50 text-red-600'
            : bucket === 'today'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-surface-100 text-surface-500'
        )
      : null;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <CompanyAvatar name={lead.company} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-surface-900">{lead.company}</p>
            <p className="truncate text-xs text-surface-500">
              {lead.contactName || 'Sin contacto'}
              {lead.role ? ` · ${lead.role}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {lead.value > 0 && (
            <span className="rounded-md bg-surface-100 px-1.5 py-0.5 text-[11px] font-semibold text-surface-600">
              {fmtMoney(lead.value)}
            </span>
          )}
          {lead.mrr > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600">
              <Repeat className="h-2.5 w-2.5" />
              {fmtMoney(lead.mrr)}/mes
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="badge bg-brand-50 text-brand-600">
          <Layers className="h-3 w-3" />
          {serviceLabel(lead.service)}
        </span>
        {lead.industry && <span className="badge bg-surface-100 text-surface-500">{lead.industry}</span>}
        <span className="badge bg-surface-100 text-surface-500">{sourceLabel(lead.source)}</span>
        {lead.meetingAt && (
          <span className="badge bg-violet-50 text-violet-600">
            <CalendarClock className="h-3 w-3" />
            {fmtDate(lead.meetingAt)}
          </span>
        )}
        {fuBadge && (
          <span className={fuBadge}>
            <BellRing className="h-3 w-3" />
            {touch!.touch}/{touch!.total > 0 ? touch!.total : '∞'} · {fmtDate(lead.nextActionAt, 'd MMM · HH:mm')}
          </span>
        )}
        {commentCount > 0 && (
          <span className="badge bg-surface-100 text-surface-500">
            <MessageCircle className="h-3 w-3" />
            {commentCount}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-surface-100 pt-2.5">
        <div className={cn('flex items-center gap-1.5 text-[11px]', fuText)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', closed ? 'bg-surface-300' : fuDot)} />
          {fromNow(lead.lastContactAt)}
        </div>
        <div className="flex items-center gap-1.5">
          {!closed && fu === 'stale' && (
            <span className="badge bg-red-50 text-red-600">
              <AlertCircle className="h-3 w-3" />
              Dar seguimiento
            </span>
          )}
          {owner && <Avatar name={owner.name} color={owner.avatarColor} size="sm" />}
        </div>
      </div>
    </>
  );
}

interface LeadCardProps {
  lead: Lead;
  owner?: User;
  commentCount?: number;
  onOpen: (lead: Lead) => void;
}

/** Sortable card — draggable within and across columns; keyboard-accessible. */
export function LeadCard({ lead, owner, commentCount, onOpen }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'lead', temperature: lead.temperature },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: stageConfig(lead.temperature).color,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group card touch-none cursor-grab select-none border-l-4 p-3 transition-shadow hover:shadow-card-hover active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
      onClick={() => onOpen(lead)}
    >
      <CardBody lead={lead} owner={owner} commentCount={commentCount} />
    </div>
  );
}

/** Non-interactive clone shown under the pointer while dragging. */
export function LeadCardOverlay({ lead, owner }: { lead: Lead; owner?: User }) {
  return (
    <div
      className="card rotate-2 border-l-4 p-3 shadow-pop"
      style={{ borderLeftColor: stageConfig(lead.temperature).color }}
    >
      <CardBody lead={lead} owner={owner} />
    </div>
  );
}
