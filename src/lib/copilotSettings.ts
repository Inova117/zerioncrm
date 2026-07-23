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
  /** Casos de éxito REALES (negocio, rubro, resultado con número). Son la
   *  munición de las anécdotas del coach — solo hay tres cosas que salen de la
   *  boca de un closer: preguntas, resúmenes y anécdotas. Sin casos aquí, el
   *  coach no inventa ninguno (contrato de verdad): ofrece la muestra gratis. */
  proof: string;
  /** Precio principal HABLADO (como se dice en voz alta en la llamada).
   *  Es la ÚNICA fuente de verdad del monto: el playbook dice [PRECIO] y aquí
   *  se resuelve. Vacío = el default del sistema. */
  priceOnce: string;
  /** Plan mensual opcional HABLADO (se resuelve donde el playbook dice [MENSUAL]). */
  priceMonthly: string;
}

/** Defaults del sistema — el único lugar del código donde vive un monto. */
export const DEFAULT_PRICE_ONCE = 'trescientos con IVA incluido';
export const DEFAULT_PRICE_MONTHLY = 'unos cuarenta al mes con IVA';

const KEY = 'zerioncrm:copilotSettings';
const EMPTY: CopilotSettings = {
  pitch: '',
  offer: '',
  tone: '',
  notes: '',
  proof: '',
  priceOnce: '',
  priceMonthly: '',
};

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
  return Boolean(s.pitch || s.offer || s.tone || s.notes || s.proof || s.priceOnce || s.priceMonthly);
}

/** Los precios hablados vigentes (Settings, o el default del sistema). */
export function getPrecios(): { once: string; monthly: string } {
  const s = getCopilotSettings();
  return {
    once: s.priceOnce.trim() || DEFAULT_PRICE_ONCE,
    monthly: s.priceMonthly.trim() || DEFAULT_PRICE_MONTHLY,
  };
}

/** Resuelve los placeholders [PRECIO]/[MENSUAL] de un texto del playbook.
 *  Se usa en TODO lo que se muestra directo al vendedor sin pasar por el LLM
 *  (battlecards instantáneas, jugadas de momento, mocks). */
export function fillPrecios(text: string): string {
  const p = getPrecios();
  return text.replaceAll('[PRECIO]', p.once).replaceAll('[MENSUAL]', p.monthly);
}

/** Bloque de texto para inyectar en el system prompt del coach. */
export function settingsForPrompt(): string {
  const s = getCopilotSettings();
  const p = getPrecios();
  const parts: string[] = [];
  // MIS PRECIOS va SIEMPRE (custom o default): es la única fuente de montos —
  // el playbook no trae ninguno, solo los placeholders.
  parts.push(
    `MIS PRECIOS (la única fuente de montos — donde el playbook diga [PRECIO] o [MENSUAL], son ESTOS, dichos tal cual): precio principal = "${p.once}", una sola vez; plan mensual opcional = "${p.monthly}".`
  );
  if (s.pitch.trim()) parts.push(`Qué vendo y mi diferenciador: ${s.pitch.trim()}`);
  if (s.offer.trim()) parts.push(`Mis paquetes y precios: ${s.offer.trim()}`);
  if (s.tone.trim()) parts.push(`Tono/estilo que quiero que uses: ${s.tone.trim()}`);
  if (s.notes.trim()) parts.push(`Frases y notas que me funcionan: ${s.notes.trim()}`);
  if (s.proof.trim())
    parts.push(
      `MIS CASOS REALES (la munición de tus anécdotas — úsalos en una frase al responder objeciones Y como la prueba antes del precio en el T2, con el rubro más parecido; JAMÁS inventes otros): ${s.proof.trim()}`
    );
  return parts.join('\n');
}
