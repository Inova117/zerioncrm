// ============================================================================
// Ajustes del Copilot — "Mi negocio y mi forma de vender".
//
// Le enseñas al coach cómo vendes TÚ (tu oferta, tus precios, tu tono, tus
// frases) y el coach deja de sonar genérico: usa ESTO por encima del playbook.
// Se guarda local a este navegador (preferencia personal) y viaja en el body
// de cada llamada al coach — no hace falta tabla ni backend.
// ============================================================================

export interface CopilotSettings {
  pitch: string; // qué vendes + tu diferenciador
  offer: string; // paquetes y precios
  tone: string; // tono/estilo del coach
  notes: string; // frases/notas que te funcionan
}

const KEY = 'zerioncrm:copilotSettings';
const EMPTY: CopilotSettings = { pitch: '', offer: '', tone: '', notes: '' };

export function getCopilotSettings(): CopilotSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<CopilotSettings>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveCopilotSettings(s: CopilotSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.error('[copilot] no se pudieron guardar los ajustes:', e);
  }
}

export function hasCopilotSettings(): boolean {
  const s = getCopilotSettings();
  return Boolean(s.pitch || s.offer || s.tone || s.notes);
}

/** Bloque de texto para inyectar en el system prompt del coach. */
export function settingsForPrompt(): string {
  const s = getCopilotSettings();
  const parts: string[] = [];
  if (s.pitch.trim()) parts.push(`Qué vendo y mi diferenciador: ${s.pitch.trim()}`);
  if (s.offer.trim()) parts.push(`Mis paquetes y precios: ${s.offer.trim()}`);
  if (s.tone.trim()) parts.push(`Tono/estilo que quiero que uses: ${s.tone.trim()}`);
  if (s.notes.trim()) parts.push(`Frases y notas que me funcionan: ${s.notes.trim()}`);
  return parts.join('\n');
}
