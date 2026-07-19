// ============================================================================
// Sales Playbook — la base de conocimiento del Copilot.
//
// Consolidado (jul 2026) en DOS pilares nombrados — LA LÍNEA RECTA (el mapa
// de toda la llamada) + EL PITCH DE CONTRASTE (dolor → contraste → retirada) —
// con las demás técnicas destiladas como jugadas sin marca, sobre datos de
// llamadas reales (Gong, 300M) + la práctica del nicho: vender web y
// automatizaciones a negocios locales latinos por teléfono.
//
// Módulos (src/data/playbook/):
//  • metodologias — tonalidades, los dos pilares, matemática del dolor,
//    precio, herramientas de tono, y el Árbitro
//  • apertura     — aperturas probadas, gatekeeper, buzón/WhatsApp, horarios
//  • cierres      — señales de compra, anti-oversell, precio, second money,
//    WhatsApp post-llamada, segunda llamada
//  • battlecards  — 30 objeciones con triggers del habla real (regex)
//    (el número se actualiza en el mismo commit que toque el array)
//  • momentos     — el GPS: detecta el momento de la llamada en tiempo real
//
// Este módulo alimenta:
//  • el system prompt del coach (playbookForPrompt) — se cachea en el server
//  • las battlecards + momentos instantáneos del cliente (sin LLM)
//  • el briefing pre-llamada del modo mock
// ============================================================================

export { SISTEMA } from './playbook/sistema';
export { PRINCIPLES, ARBITRO } from './playbook/metodologias';
export { OPENERS } from './playbook/apertura';
export { CLOSES } from './playbook/cierres';
export { POSTVENTA } from './playbook/postventa';
export { NEPQ } from './playbook/nepq';
export { EJEMPLOS } from './playbook/ejemplos';
export { BATTLECARDS, type Battlecard } from './playbook/battlecards';
export { normalizeSpeech } from './playbook/normalize';
export {
  detectMoment,
  detectHora,
  momentsForPrompt,
  MOMENTS,
  type CallMoment,
  type MomentInfo,
} from './playbook/momentos';

import { SISTEMA } from './playbook/sistema';
import { PRINCIPLES, ARBITRO } from './playbook/metodologias';
import { OPENERS } from './playbook/apertura';
import { CLOSES } from './playbook/cierres';
import { POSTVENTA } from './playbook/postventa';
import { NEPQ } from './playbook/nepq';
import { EJEMPLOS } from './playbook/ejemplos';
import { BATTLECARDS, type Battlecard } from './playbook/battlecards';
import { normalizeSpeech } from './playbook/normalize';
import { momentsForPrompt } from './playbook/momentos';

// ---------------------------------------------------------------------------
// Detección instantánea (cliente, sin LLM)
// ---------------------------------------------------------------------------
/** Devuelve la battlecard si el texto contiene una objeción conocida. */
export function detectObjection(text: string): Battlecard | null {
  const t = normalizeSpeech(text);
  for (const card of BATTLECARDS) {
    if (card.triggers.test(t)) return card;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Playbook completo como texto para el system prompt del coach
// ---------------------------------------------------------------------------
export function playbookForPrompt(): string {
  const cards = BATTLECARDS.map(
    (c) => `### ${c.objection}\nRespuesta: ${c.response}\nPrincipio: ${c.why}`
  ).join('\n\n');
  return [
    SISTEMA,
    ARBITRO,
    PRINCIPLES,
    NEPQ,
    OPENERS,
    CLOSES,
    POSTVENTA,
    '## MOMENTOS DE LA LLAMADA (detecta en cuál está y juega LA jugada de ese momento)',
    momentsForPrompt(),
    '## MANEJO DE OBJECIONES (responde con estas líneas, adaptadas al contexto del prospecto)',
    cards,
    EJEMPLOS,
  ].join('\n\n');
}
