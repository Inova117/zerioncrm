import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { normalizeDomain } from '../lib/normalize.js';

/** Directory/aggregator hosts that never count as the business's own site. */
const DIRECTORY_HOSTS = new Set([
  'facebook.com',
  'instagram.com',
  'yelp.com',
  'angi.com',
  'homeadvisor.com',
  'bbb.org',
  'yellowpages.com',
  'mapquest.com',
  'thumbtack.com',
  'houzz.com',
  'porch.com',
  'nextdoor.com',
  'linkedin.com',
  'google.com',
  'tripadvisor.com',
  'doordash.com',
  'ubereats.com',
  'grubhub.com',
]);

const GENERIC_TOKENS = new Set(['llc', 'inc', 'corp', 'company', 'services', 'service', 'the', 'and']);

export interface SerpResult {
  url: string | null;
  /** false = SERP was NOT consulted (no API key / request failed) — the
   * no_website classification is then provisional, from Maps data alone. */
  confirmed: boolean;
}

/**
 * One branded query per no-website lead to rule out a Maps data gap: worst
 * possible error is telling an owner "you have no website" when they do.
 */
export async function findWebsiteViaSerp(name: string, city: string | null): Promise<SerpResult> {
  if (!env.SERPER_API_KEY) return { url: null, confirmed: false };

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `"${name}" ${city ?? ''}`.trim(), num: 5, gl: 'us' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`serper HTTP ${response.status}`);
    const data = (await response.json()) as { organic?: Array<{ link?: string }> };

    const tokens = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t));

    for (const result of data.organic ?? []) {
      if (!result.link) continue;
      const domain = normalizeDomain(result.link);
      if (!domain || DIRECTORY_HOSTS.has(domain)) continue;
      const domainBody = domain.split('.').slice(0, -1).join('');
      if (tokens.some((t) => domainBody.includes(t))) {
        return { url: new URL(result.link).origin, confirmed: true };
      }
    }
    return { url: null, confirmed: true };
  } catch (error) {
    logger.warn({ name, error: String(error) }, 'serper lookup failed — provisional segment');
    return { url: null, confirmed: false };
  }
}
