// Normalización compartida para el matching de voz: lo que llega del
// transcriptor viene con mayúsculas, acentos inconsistentes y a veces espacios
// al borde (al concatenar segmentos del STT) — sin el trim, los cues anclados
// con ^ (p.ej. "^alo") jamás matchean " aló".
/** Normaliza para matching: lowercase + sin acentos + sin espacios al borde. */
export const normalizeSpeech = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
