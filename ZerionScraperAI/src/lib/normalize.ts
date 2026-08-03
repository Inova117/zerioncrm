/** Hosts that are social/link-hub pages, not a business's own website. */
const SOCIAL_HOSTS = new Set([
  'facebook.com',
  'm.facebook.com',
  'instagram.com',
  'linktr.ee',
  'wa.me',
  'api.whatsapp.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'youtube.com',
  'yelp.com',
  'google.com',
]);

function hostnameOf(url: string): string | null {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isSocialUrl(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  return SOCIAL_HOSTS.has(host) || [...SOCIAL_HOSTS].some((s) => host.endsWith(`.${s}`));
}

/**
 * Dedupe key #2: the business's own domain, lowercased, without www.
 * Social/link-hub URLs return null — they are not a website of their own
 * (segmentation later marks those leads social_only).
 */
export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = hostnameOf(url);
  if (!host || isSocialUrl(url)) return null;
  return host;
}

/**
 * Dedupe key #3: digits-only phone. US 10-digit numbers get a leading 1 so
 * "(713) 555-0100" and "+1 713 555 0100" collide.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 10) return `1${digits}`;
  return digits;
}
