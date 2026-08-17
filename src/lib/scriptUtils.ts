// ============================================================================
// Utilidades del guion de llamada por prospecto (Sales Copilot)
// ============================================================================

/** Datos del prospecto que el guion necesita para personalizarse (subconjunto
 *  de Lead — el panel solo usa estos). */
export interface ScriptLeadVars {
  company?: string;
  contactName?: string;
  industry?: string;
  temperature?: string;
  /** Línea de oferta del lead (Service: 'web' | 'aaas' | …). Decide qué guion
   *  muestra el panel (web vs AI agent). */
  service?: string;
  enrichment?: {
    city?: string;
    /** Google rating del negocio (4.6, 4.9…). Alimenta [RESEÑAS]. */
    rating?: number;
    /** Nº de reseñas de Google (35, 128…). Alimenta [RESEÑAS]. */
    reviewCount?: number;
    /** Perfiles sociales del negocio (Instagram, Facebook…). Alimenta [SOCIALES]. */
    socials?: string[] | null;
    /** Línea ganadora del scoring dual de prospección (si ya se calculó). */
    offer?: 'web' | 'aaas' | null;
  } | null;
}

/** Primer nombre de un nombre completo ("Marta Ruiz" → "Marta"). */
function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? '';
}

/** "Marta Ruiz" → "Doña Marta" · "Juan Pérez" → "Don Juan" · "" → "Buenas".
 *  Heurística de género por terminación (español): casi todos los nombres
 *  femeninos terminan en 'a'. Sin nombre, el saludo neutral "Buenas". */
export function saludoNombre(full?: string): string {
  const n = firstName(full ?? '');
  if (!n) return 'Buenas';
  return n.endsWith('a') ? `Doña ${n}` : `Don ${n}`;
}

/** Resuelve las variables del prospecto en el texto del guion (sin LLM):
 *  [SALUDO]   → "Doña Marta" / "Don Juan" / "Buenas"
 *  [NOMBRE]   → "Marta, de ZerionStudio" / "de ZerionStudio" (auto-presentación)
 *  [rubro]    → industria en minúscula / "negocios como el suyo"
 *  [CIUDAD]   → ciudad / "su zona"
 *  [EMPRESA]  → nombre del negocio / "su negocio"
 *  [RESEÑAS]  → "35 reseñas" / "muy buenas reseñas"
 *  [RATING]   → "4.6 estrellas" / "excelente calificación"
 *  [SOCIALES] → "hasta Instagram" / "redes sociales"
 *  Cada variable tiene un fallback que suena natural hablado. */
export function fillLeadVars(text: string, lead?: ScriptLeadVars | null): string {
  const saludo = saludoNombre(lead?.contactName);
  const nombre = firstName(lead?.contactName ?? '');
  const rubro = lead?.industry?.trim().toLowerCase() || 'negocios como el suyo';
  const ciudad = lead?.enrichment?.city?.trim() || 'su zona';
  const empresa = empresaLimpia(lead);
  const reseñas = lead?.enrichment?.reviewCount
    ? `${lead.enrichment.reviewCount} reseñas`
    : 'muy buenas reseñas';
  const rating = lead?.enrichment?.rating
    ? `${lead.enrichment.rating} estrellas`
    : 'excelente calificación';
  const sociales = firstSocial(lead?.enrichment?.socials);
  return text
    .replaceAll('[SALUDO]', saludo)
    .replaceAll('[NOMBRE]', nombre ? `${nombre}, de ZerionStudio` : 'de ZerionStudio')
    .replaceAll('[rubro]', rubro)
    .replaceAll('[CIUDAD]', ciudad)
    .replaceAll('[EMPRESA]', empresa)
    .replaceAll('[RESEÑAS]', reseñas)
    .replaceAll('[RATING]', rating)
    .replaceAll('[SOCIALES]', sociales);
}

/** El scraper a veces guarda el nombre con la ciudad pegada
 *  ("Elite Peluquería - Ambato") — se ve técnico y feo hablado. Si el sufijo
 *  tras el guion coincide con enrichment.city, se recorta: "Elite Peluquería".
 *  Solo recorta cuando la ciudad coincide exactamente — nunca inventar. */
function empresaLimpia(lead?: ScriptLeadVars | null): string {
  const raw = lead?.company?.trim() || 'su negocio';
  const city = lead?.enrichment?.city?.trim();
  if (!city) return raw;
  const re = new RegExp(`\\s*[—–-]\\s*${escapeRegExp(city)}\\s*$`, 'i');
  return raw.replace(re, '');
}

/** Escapa caracteres especiales de regex para coincidencia literal. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Nombre de la primera red social del negocio ("https://instagram.com/x" →
 *  "Instagram") — para el cumplido "…y hasta [SOCIALES]…". Sin redes,
 *  el fallback "redes sociales". */
function firstSocial(socials?: string[] | null): string {
  const url = socials?.find((s) => /instagram|facebook|tiktok/i.test(s));
  if (!url) return 'redes sociales';
  const m = url.match(/instagram|facebook|tiktok/i);
  const name = m ? m[0] : 'redes';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Divide un guion de cliente en pasos navegables (para leerlo en pantalla
 * durante la llamada).
 *
 * Regla simple y predecible: los bloques separados por línea en blanco son
 * pasos. Si el guion es un bloque único (sin líneas en blanco), cada línea
 * es un paso. Devuelve [] para texto vacío/solo espacios.
 */
export function splitScriptSteps(script: string): string[] {
  const text = script.replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const byBlank = text
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
