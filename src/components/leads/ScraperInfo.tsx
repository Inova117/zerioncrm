import { Radar, MapPin, ExternalLink, Star, Share2, Mail, MessageCircle } from 'lucide-react';
import type { LeadEnrichment } from '../../types';
import { googleMapsUrl, mailLink, waLink } from '../../lib/utils';

/** Human label for a social-profile URL (scraped from the business). */
function socialLabel(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('instagram')) return 'Instagram';
  if (u.includes('facebook')) return 'Facebook';
  if (u.includes('linkedin')) return 'LinkedIn';
  if (u.includes('youtube')) return 'YouTube';
  if (u.includes('tiktok')) return 'TikTok';
  if (u.includes('twitter') || u.includes('x.com')) return 'X';
  return 'Red social';
}

/** The "Datos del scraper" card — everything known about a Google-Maps business.
 * Shared by the saved-lead detail and the candidate preview. */
export function ScraperInfo({
  enrichment: e,
  website,
  company,
}: {
  enrichment: LeadEnrichment;
  website: string;
  company: string;
}) {
  const gmaps = googleMapsUrl(e);
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-brand-500">
        <Radar className="h-3.5 w-3.5" />
        Datos del scraper
      </p>

      {/* Photo + "ver la empresa" en Google Maps */}
      <div className="mb-2.5 flex items-center gap-2.5">
        {e.image && (
          <img
            src={e.image}
            alt={company}
            referrerPolicy="no-referrer"
            onError={(ev) => (ev.currentTarget.style.display = 'none')}
            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-surface-200"
          />
        )}
        {gmaps && (
          <a href={gmaps} target="_blank" rel="noreferrer" className="btn-secondary px-2.5 py-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> Ver en Google Maps
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        )}
      </div>

      {(e.fullAddress || e.address) && (
        <p className="mb-2.5 text-xs leading-snug text-surface-500">{e.fullAddress || e.address}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {!website.trim() && (
          <span className="badge bg-brand-100 font-semibold text-brand-700">Sin sitio web</span>
        )}
        {e.rating != null && (
          <span className="badge bg-white text-surface-600">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {e.rating}
            {e.reviewCount != null && ` · ${e.reviewCount} reseñas`}
          </span>
        )}
        {e.price && <span className="badge bg-white text-surface-600">{e.price}</span>}
        {e.city && !e.fullAddress && (
          <span className="badge bg-white text-surface-600">
            <MapPin className="h-3 w-3" />
            {e.city}
          </span>
        )}
        {e.score != null && <span className="badge bg-white text-surface-600">Score {e.score}</span>}
        {e.email && (
          <a href={mailLink(e.email)} className="badge bg-white text-surface-600 hover:bg-surface-100">
            <Mail className="h-3 w-3" /> {e.email}
          </a>
        )}
        {e.whatsapp && (
          <a
            href={waLink(e.whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="badge bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </a>
        )}
        {(e.socials ?? []).map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="badge bg-white text-surface-600 hover:bg-surface-100"
          >
            <Share2 className="h-3 w-3" /> {socialLabel(url)}
          </a>
        ))}
      </div>
    </div>
  );
}
