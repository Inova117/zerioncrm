import { Star, Phone, MessageCircle, Globe, MapPin, ArrowRight, Check, Trash2 } from 'lucide-react';
import type { Lead } from '../../types';
import { TemperatureBadge } from '../ui/TemperatureBadge';
import { cn, colorFromString, googleMapsUrl, initials, telLink, waLink, webLink } from '../../lib/utils';

interface LeadFinderCardProps {
  lead: Lead;
  onOpen: (lead: Lead) => void;
  /** When true, the card shows a selection checkbox instead of the stage badge. */
  selectable?: boolean;
  selected?: boolean;
  /** Already saved to leads → green. */
  saved?: boolean;
  onToggleSelect?: () => void;
  /** Optional delete (used in the "Descubiertos" tab). */
  onDelete?: () => void;
}

/** sitedrop-style lead box: name, rating, phone, and a prominent "no website" flag. */
export function LeadFinderCard({
  lead,
  onOpen,
  selectable = false,
  selected = false,
  saved = false,
  onToggleSelect,
  onDelete,
}: LeadFinderCardProps) {
  const e = lead.enrichment ?? null;
  const hasWebsite = Boolean(lead.website.trim());
  const city = e?.city;
  const phone = lead.phone || e?.whatsapp || '';
  const gmaps = googleMapsUrl(e);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onOpen(lead)}
      className={cn(
        'group card flex cursor-pointer flex-col p-4 text-left transition-shadow hover:shadow-card-hover',
        selected && 'ring-2 ring-brand-400',
        saved && 'bg-emerald-50/40 ring-1 ring-emerald-200'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: colorFromString(lead.company || '?') }}
          >
            {initials(lead.company) || '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-surface-900">{lead.company}</p>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-surface-500">
              {e?.rating != null ? (
                <>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-surface-600">{e.rating}</span>
                  {e.reviewCount != null && <span className="text-surface-400">· {e.reviewCount} reseñas</span>}
                </>
              ) : (
                <span className="text-surface-400">{lead.industry || 'Sin categoría'}</span>
              )}
            </div>
          </div>
        </div>
        {selectable ? (
          saved ? (
            <span className="badge shrink-0 bg-emerald-50 font-medium text-emerald-600">
              <Check className="h-3 w-3" /> Guardado
            </span>
          ) : (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.()}
              onClick={(ev) => ev.stopPropagation()}
              aria-label={`Seleccionar ${lead.company}`}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            />
          )
        ) : (
          <TemperatureBadge temperature={lead.temperature} />
        )}
      </div>

      {/* Website flag — the money signal for a web-dev agency */}
      <div className="mt-3">
        {hasWebsite ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-surface-100 px-2 py-1 text-xs font-medium text-surface-500">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Sin sitio web
          </span>
        )}
      </div>

      {/* Contact + location */}
      <div className="mt-3 space-y-1 text-xs text-surface-500">
        {phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0 text-surface-400" />
            <span>{phone}</span>
          </div>
        )}
        {(e?.address || city) && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-surface-400" />
            <span className="truncate">{e?.address || city}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-surface-100 pt-2.5">
        <div className="flex items-center gap-1">
          {phone && (
            <>
              <IconLink href={telLink(phone)} label="Llamar">
                <Phone className="h-3.5 w-3.5" />
              </IconLink>
              <IconLink href={waLink(phone)} label="WhatsApp" external>
                <MessageCircle className="h-3.5 w-3.5" />
              </IconLink>
            </>
          )}
          {hasWebsite && (
            <IconLink href={webLink(lead.website)} label="Abrir sitio" external>
              <Globe className="h-3.5 w-3.5" />
            </IconLink>
          )}
          {gmaps && (
            <IconLink href={gmaps} label="Ver en Google Maps" external>
              <MapPin className="h-3.5 w-3.5" />
            </IconLink>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete();
              }}
              title="Quitar de descubiertos"
              aria-label="Quitar de descubiertos"
              className="flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
          Ver <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

function IconLink({
  href,
  label,
  external,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      onClick={(ev) => ev.stopPropagation()}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-surface-500',
        'hover:bg-surface-100 hover:text-brand-600'
      )}
    >
      {children}
    </a>
  );
}
