// ============================================================================
// nicheCatalog — catálogo de nichos → línea de oferta (web vs AI agent).
// Data-driven (patrón SOURCES/SERVICES de constants.ts). `nicheFor()` es PURA
// y testeable: dado el businessType de una búsqueda, devuelve si el nicho es
// de web, de AI agent o ambiguo (se decide por las variables de cada negocio).
//
// Regla de negocio (acordada ago 2026):
//   - Web: nichos donde "te buscan en Google" y no aparecer les cuesta clientes.
//   - AI agent (secretaria virtual): nichos con mucha atención por WhatsApp /
//     agendamiento (clínicas, peluquerías, ópticas, veterinarias, gimnasios).
//   - Ambiguo (restaurantes): compite en igualdad → gana el score mayor.
// ============================================================================
import type { OfferLine } from '../types';

export type NichePrimary = OfferLine | 'ambigua';

export interface NicheEntry {
  key: string;
  label: string;
  /** Subcadenas (minúsculas) para casar contra el businessType de la búsqueda. */
  synonyms: string[];
  primary: NichePrimary;
  /** Dolor que resuelve la oferta (para mensajes y fichas). */
  pain: string;
}

export const NICHES: NicheEntry[] = [
  // --- Web: se les busca en Google; no aparecer les cuesta clientes ----------
  { key: 'contabilidad', label: 'Contabilidad', primary: 'web',
    synonyms: ['contab', 'contador', 'contadores', 'asesor fiscal', 'tributario', 'contabilidad'],
    pain: 'No aparecen en Google cuando los buscan' },
  { key: 'autos', label: 'Autos', primary: 'web',
    synonyms: ['auto', 'autos', 'taller', 'mecanico', 'mecánico', 'mecánica', 'concesionar', 'lavadora de autos', 'lubricentro', 'carrocería'],
    pain: 'No aparecen en Google cuando los buscan' },
  { key: 'abogados', label: 'Abogados', primary: 'web',
    synonyms: ['abogado', 'abogados', 'bufete', 'estudio juridico', 'estudio jurídico', 'firma legal'],
    pain: 'No aparecen en Google cuando los buscan' },
  { key: 'escuelas', label: 'Escuelas', primary: 'web',
    synonyms: ['escuela', 'colegio', 'instituto', 'academia', 'centro educativo', 'guarderia', 'guardería'],
    pain: 'No aparecen en Google cuando los buscan' },
  { key: 'coaches', label: 'Coaches', primary: 'web',
    synonyms: ['coach', 'coaching', 'mentor', 'consultor'],
    pain: 'No aparecen en Google cuando los buscan' },
  { key: 'psicologos', label: 'Psicólogos', primary: 'web',
    synonyms: ['psicolog', 'psicólog', 'psiquiatra', 'terapeuta'],
    pain: 'No aparecen en Google cuando los buscan' },
  // --- AI agent: mucha atención por WhatsApp / agendamiento ------------------
  { key: 'clinicas', label: 'Clínicas', primary: 'aaas',
    synonyms: ['clinica', 'clínica', 'centro medico', 'centro médico', 'dental', 'dentista', 'odontolog', 'fisioterapia', 'consultorio'],
    pain: 'WhatsApp saturado y agendamiento manual' },
  { key: 'veterinarias', label: 'Veterinarias', primary: 'aaas',
    synonyms: ['veterinaria', 'veterinario'],
    pain: 'Citas y urgencias por WhatsApp saturadas' },
  { key: 'opticas', label: 'Ópticas', primary: 'aaas',
    synonyms: ['optica', 'óptica', 'lentes', 'oftalmolog'],
    pain: 'Citas por WhatsApp saturadas' },
  { key: 'peluquerias', label: 'Peluquerías', primary: 'aaas',
    synonyms: ['peluqueria', 'peluquería', 'salon', 'salón', 'barberia', 'barbería', 'spa', 'estetica', 'estética', 'uñas'],
    pain: 'Citas por WhatsApp saturadas' },
  { key: 'gimnasios', label: 'Gimnasios', primary: 'aaas',
    synonyms: ['gimnasio', 'fitness', 'crossfit', 'entrenamiento', 'personal trainer'],
    pain: 'Agendamiento de clases y membresías' },
  // --- Ambiguo: se decide por las variables de cada negocio ------------------
  { key: 'restaurantes', label: 'Restaurantes', primary: 'ambigua',
    synonyms: ['restaurante', 'restaurantes', 'comida', 'cafeteria', 'cafetería', 'bar', 'pizzeria', 'pizzería', 'cevicheria', 'cevichería'],
    pain: 'Demanda de atención por WhatsApp / reservas' },
];

/**
 * Línea de oferta para un query de búsqueda. Match por subcadena (sinónimos,
 * minúsculas). Vacío o desconocido → 'ambigua' (se decide por las variables).
 * El primer nicho que matchea gana — sinónimos más específicos primero.
 */
export function nicheFor(query: string): NichePrimary {
  const q = query.trim().toLowerCase();
  if (!q) return 'ambigua';
  for (const n of NICHES) {
    if (n.synonyms.some((s) => q.includes(s))) return n.primary;
  }
  return 'ambigua';
}

/** La entrada completa del catálogo para un query (undefined si no matchea). */
export function nicheEntry(query: string): NicheEntry | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return NICHES.find((n) => n.synonyms.some((s) => q.includes(s)));
}
