import { eq } from 'drizzle-orm';
import { audits, reviews } from '../../db/schema.js';
import { logger } from '../../lib/logger.js';
import {
  detectAnalytics,
  detectLanguageFromHtml,
  detectLanguageFromText,
  detectParked,
  extractCopyrightYear,
  extractCtas,
  extractSocialLinks,
  extractWhatsAppPhone,
} from '../audit/html.js';
import { checkSsl } from '../audit/ssl.js';
import type { Db } from '../../db/index.js';
import type { Lead, LeadStage } from '../types.js';

interface FetchedPage {
  finalUrl: string;
  status: number;
  html: string;
}

async function fetchPage(url: string): Promise<FetchedPage | null> {
  const candidates = /^https?:\/\//i.test(url)
    ? [url, url.replace(/^https:/i, 'http:')]
    : [`https://${url}`, `http://${url}`];

  for (const candidate of [...new Set(candidates)]) {
    try {
      const response = await fetch(candidate, {
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'user-agent':
            'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
        },
      });
      const html = await response.text();
      return { finalUrl: response.url || candidate, status: response.status, html };
    } catch {
      // try next scheme
    }
  }
  return null;
}

function languageFromReviews(db: Db, leadId: number): 'es' | 'en' | null {
  const rows = db
    .select({ text: reviews.text })
    .from(reviews)
    .where(eq(reviews.leadId, leadId))
    .all();
  const corpus = rows
    .map((r) => r.text)
    .filter(Boolean)
    .join(' ');
  return corpus ? detectLanguageFromText(corpus) : null;
}

/**
 * segmented → audited. Browserless triage (~seconds/lead): site up/parked,
 * SSL, copyright staleness, analytics, language, CTA presence, social +
 * WhatsApp capture. Every field is a potential call talking-point.
 * Deep pass (PSI score + Playwright screenshot) lands on day 5 and enriches
 * the same audits row.
 */
export const triageStage: LeadStage = {
  name: 'triage',
  from: 'segmented',
  to: 'audited',
  handler: async (db, lead) => {
    const updates: Partial<Lead> = {};

    if (lead.segment !== 'has_website' || !lead.websiteUrl) {
      // No site to fetch — language comes from their Google reviews.
      db.insert(audits)
        .values({ leadId: lead.id })
        .onConflictDoNothing({ target: audits.leadId })
        .run();
      const language = languageFromReviews(db, lead.id);
      if (language) updates.language = language;
      return updates;
    }

    const page = await fetchPage(lead.websiteUrl);
    const host = lead.normalizedDomain ?? new URL(page?.finalUrl ?? `https://${lead.websiteUrl}`).hostname;
    const ssl = await checkSsl(host);

    const html = page?.html ?? '';
    const siteUp = page !== null && page.status >= 200 && page.status < 400 && html.length > 0;
    const parked = siteUp && detectParked(html);

    const auditRow = {
      leadId: lead.id,
      httpStatus: page?.status ?? null,
      siteUp,
      parked,
      sslOk: ssl.ok,
      sslExpiresAt: ssl.expiresAt,
      copyrightYear: siteUp ? extractCopyrightYear(html) : null,
      analyticsDetected: siteUp ? detectAnalytics(html) : null,
      detectedLanguage: siteUp ? detectLanguageFromHtml(html) : null,
      ctas: siteUp ? extractCtas(html) : null,
    };
    db.insert(audits)
      .values(auditRow)
      .onConflictDoUpdate({ target: audits.leadId, set: auditRow })
      .run();

    if (parked || !siteUp) {
      // Broken/parked site — strongest hook, and effectively the no-site pitch.
      updates.segment = 'parked';
    }

    const language = auditRow.detectedLanguage ?? languageFromReviews(db, lead.id);
    if (language) updates.language = language;

    if (siteUp) {
      const socials = extractSocialLinks(html);
      if (socials.length) updates.socialLinks = socials;
      const whatsapp = extractWhatsAppPhone(html);
      if (whatsapp) updates.whatsappPhone = whatsapp;
    }

    logger.debug(
      { lead: lead.name, siteUp, parked, ssl: ssl.ok, lang: language ?? 'unknown' },
      'triage done',
    );
    return updates;
  },
};
