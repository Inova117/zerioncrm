// ============================================================================
// leadService — decide la línea de oferta de un lead del CRM (web vs AI agent).
//
// Regla de precedencia (acordada en "prospección automática por servicio",
// ago 2026 — reutiliza el catálogo de nichos y el scoring dual ya existentes):
//   1. enrichment.offer  → el scoring dual ya lo calculó (señal autoritativa).
//   2. lead.service      → etiqueta explícita del lead ('aaas' → agente; 'web' → web).
//   3. nicheFor(industry) → catálogo de nichos; 'ambigua' cae a 'web' por defecto
//      (el guion actual es el de webs).
// PURA y testeable (sin React/Supabase).
// ============================================================================
import type { OfferLine } from '../types';
import { nicheFor } from './nicheCatalog';

export interface LeadServiceInput {
  service?: string | null;
  industry?: string | null;
  enrichment?: { offer?: OfferLine | null } | null;
}

export function leadOfferLine(lead?: LeadServiceInput | null): OfferLine {
  // 1. El scoring dual ya resolvió (enrichment.offer, de la prospección automática).
  if (lead?.enrichment?.offer) return lead.enrichment.offer;
  // 2. Etiqueta explícita del servicio en el lead.
  if (lead?.service === 'aaas') return 'aaas';
  if (lead?.service === 'web') return 'web';
  // 3. Catálogo de nichos (industry). 'ambigua' → web (guion por defecto).
  if (nicheFor(lead?.industry ?? '') === 'aaas') return 'aaas';
  return 'web';
}
