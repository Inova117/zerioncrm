import { logger } from '../../lib/logger.js';
import { extractWhatsAppPhone } from '../audit/html.js';
import { isSocialUrl, normalizeDomain } from '../../lib/normalize.js';
import { findWebsiteViaSerp } from '../serper.js';
import type { Lead, LeadStage } from '../types.js';

/**
 * new → segmented. Classifies has_website / social_only / no_website
 * ('parked' is refined by triage after actually fetching the site).
 * For Maps-null websites, one branded SERP query rules out a data gap —
 * the pitch must never claim "you have no website" to someone who does.
 */
export const segmentStage: LeadStage = {
  name: 'segment',
  from: 'new',
  to: 'segmented',
  handler: async (_db, lead) => {
    if (lead.normalizedDomain) {
      return { segment: 'has_website' };
    }

    if (lead.websiteUrl && isSocialUrl(lead.websiteUrl)) {
      const updates: Partial<Lead> = { segment: 'social_only', socialLinks: [lead.websiteUrl] };
      const whatsapp = extractWhatsAppPhone(lead.websiteUrl);
      if (whatsapp) updates.whatsappPhone = whatsapp;
      return updates;
    }

    const serp = await findWebsiteViaSerp(lead.name, lead.city);
    if (serp.url) {
      logger.info({ lead: lead.name, found: serp.url }, 'SERP found a website Maps missed');
      return {
        segment: 'has_website',
        websiteUrl: serp.url,
        normalizedDomain: normalizeDomain(serp.url),
      };
    }
    if (!serp.confirmed) {
      logger.warn({ lead: lead.name }, 'no_website is PROVISIONAL (SERP not consulted)');
    }
    return { segment: 'no_website' };
  },
};
