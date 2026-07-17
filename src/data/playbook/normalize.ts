// Normalización compartida para el matching de voz: lo que llega del
// transcriptor viene con mayúsculas y acentos inconsistentes.
/** Normaliza para matching: lowercase + sin acentos. */
export const normalizeSpeech = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
