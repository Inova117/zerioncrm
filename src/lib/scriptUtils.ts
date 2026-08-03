// ============================================================================
// Utilidades del guion de llamada por prospecto (Sales Copilot)
// ============================================================================

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
