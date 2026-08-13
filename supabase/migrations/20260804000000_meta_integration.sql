-- ============================================================================
-- Integración Meta (Facebook) — Lead Ads (inbound) + Conversions API (outbound)
-- ----------------------------------------------------------------------------
-- ESPEJO de los cambios equivalentes en supabase/schema.sql (mantener en sync).
-- Todo idempotente: seguro de correr varias veces.
--
--   * source_t += 'meta'          → origen del prospecto (webhook Lead Ads)
--   * leads.meta_lead_id          → id que Meta genera (15-17 díg.), match key
--   * leads.fbclid                → click id de Facebook, match key
--   * leads_meta_lead_id_uidx     → un lead por leadgen_id (webhook idempotente)
--
-- No requiere políticas RLS nuevas: son columnas de la tabla leads existente y
-- heredan sus RLS. El insert desde el webhook lo hace la Edge Function con
-- service_role (salta RLS), igual que find-leads.
-- ============================================================================

-- 'meta' como origen de lead. ADD VALUE IF NOT EXISTS es no-op si ya existe.
alter type source_t add value if not exists 'meta';

-- Columnas de match de Meta en la tabla leads.
alter table public.leads add column if not exists meta_lead_id text;
alter table public.leads add column if not exists fbclid       text;

-- Un lead de Meta es único por su leadgen_id: si el webhook reintenta (Meta
-- reenvía si no respondes 200 en ~20s), el segundo insert choca contra este
-- índice y la Edge Function lo trata como duplicado en vez de crear otro lead.
-- Índice parcial: solo cubre filas con meta_lead_id, así los leads no-Meta
-- (meta_lead_id NULL) nunca colisionan entre sí.
create unique index if not exists leads_meta_lead_id_uidx
  on public.leads(meta_lead_id) where meta_lead_id is not null;
