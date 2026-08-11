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
  enrichment?: { city?: string } | null;
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
 *  Cada variable tiene un fallback que suena natural hablado. */
export function fillLeadVars(text: string, lead?: ScriptLeadVars | null): string {
  const saludo = saludoNombre(lead?.contactName);
  const nombre = firstName(lead?.contactName ?? '');
  const rubro = lead?.industry?.trim().toLowerCase() || 'negocios como el suyo';
  const ciudad = lead?.enrichment?.city?.trim() || 'su zona';
  const empresa = lead?.company?.trim() || 'su negocio';
  return text
    .replaceAll('[SALUDO]', saludo)
    .replaceAll('[NOMBRE]', nombre ? `${nombre}, de ZerionStudio` : 'de ZerionStudio')
    .replaceAll('[rubro]', rubro)
    .replaceAll('[CIUDAD]', ciudad)
    .replaceAll('[EMPRESA]', empresa);
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
