/**
 * Pure HTML analysis helpers for the browserless triage pass (day 4).
 * Each detection feeds a call talking-point, so false positives are worse
 * than false negatives — patterns are deliberately conservative.
 */

const PARKED_PATTERNS = [
  /domain (?:is )?for sale/i,
  /buy this domain/i,
  /sedoparking/i,
  /hugedomains\.com/i,
  /parked free.{0,30}godaddy/i,
  /this domain has expired/i,
  /account (?:has been )?suspended/i,
  /dan\.com.{0,40}for sale/i,
];

export function detectParked(html: string): boolean {
  return PARKED_PATTERNS.some((p) => p.test(html));
}

/** Latest year in a ©/copyright notice — stale year = outdated-site hook. */
export function extractCopyrightYear(html: string): number | null {
  const re = /(?:©|&copy;|&#169;|copyright)[\s:]*(?:\d{4}\s*[-–—]\s*)?(\d{4})/gi;
  let latest: number | null = null;
  for (const match of html.matchAll(re)) {
    const year = Number(match[1]);
    if (year >= 1990 && year <= 2100 && (latest === null || year > latest)) latest = year;
  }
  return latest;
}

export function detectAnalytics(html: string): boolean {
  return /googletagmanager\.com|google-analytics\.com|gtag\(|fbq\(|connect\.facebook\.net|clarity\.ms|static\.hotjar\.com/i.test(
    html,
  );
}

export function detectLanguageFromHtml(html: string): 'es' | 'en' | null {
  const lang = /<html[^>]*\slang=["']?([a-z]{2})/i.exec(html)?.[1]?.toLowerCase();
  if (lang === 'es' || lang === 'en') return lang;
  return detectLanguageFromText(html.replace(/<[^>]+>/g, ' '));
}

// Includes review-speak ("excelente", "recomiendo", "great", "recommend") —
// for no-website leads, short Google reviews are often the only signal.
const ES_WORDS = /\b(el|la|los|las|que|para|con|por|una|muy|más|mas|buen[oa]?|excelente|recomiendo|recomendado|precio|rápido|rapido|puntuales?|nuestro|nuestra|servicios?|años|anos|trabajo|calidad|llámenos|contáctenos|nosotros|hoy|gratis|cita|presupuesto|hicieron|siempre|gracias)\b/gi;
const EN_WORDS = /\b(the|and|for|with|our|we|you|your|they|was|were|services?|years|work(ed)?|quality|call(ed)?|contact|about|today|free|appointment|estimate|great|good|recommend(ed)?|price|fast|time|job)\b/gi;

/** Naive stopword vote — good enough to route es/en; recalibrate if noisy. */
export function detectLanguageFromText(text: string): 'es' | 'en' | null {
  const es = (text.match(ES_WORDS) ?? []).length;
  const en = (text.match(EN_WORDS) ?? []).length;
  if (es < 2 && en < 2) return null;
  if (es > en * 1.2) return 'es';
  if (en > es * 1.2) return 'en';
  return null;
}

export interface CtaFlags {
  form: boolean;
  whatsapp: boolean;
  phone: boolean;
  booking: boolean;
  quote: boolean;
}

/** Missing conversion features are among the strongest pitch hooks (F4). */
export function extractCtas(html: string): CtaFlags {
  return {
    form: /<form[\s>]/i.test(html),
    whatsapp: /wa\.me\/|api\.whatsapp\.com\/send/i.test(html),
    phone: /href=["']tel:/i.test(html),
    booking:
      /\b(book (now|online)|schedule|make an appointment|reserv[ea]r?|agendar?( una)? cita|agenda tu)\b/i.test(
        html,
      ),
    quote: /\b((get|request|free) a? ?(quote|estimate)|cotizaci[oó]n|cotiza|presupuesto)\b/i.test(
      html,
    ),
  };
}

export function extractSocialLinks(html: string): string[] {
  const re = /https?:\/\/(?:www\.)?(?:facebook|instagram)\.com\/[a-zA-Z0-9_.\-/%]+/g;
  const found = new Set<string>();
  for (const match of html.match(re) ?? []) {
    if (found.size >= 5) break;
    found.add(match.replace(/[),.'"]+$/, ''));
  }
  return [...found];
}

/** Digits from a wa.me / api.whatsapp.com link — the WhatsApp channel key. */
export function extractWhatsAppPhone(text: string): string | null {
  const wa = /wa\.me\/(\d{7,15})/.exec(text) ?? /api\.whatsapp\.com\/send\?phone=(\d{7,15})/.exec(text);
  return wa?.[1] ?? null;
}
