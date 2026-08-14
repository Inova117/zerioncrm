-- ============================================================================
-- Pipeline v2 (ago 2026): etapas = PRÓXIMA ACCIÓN con fecha + sistema de
-- seguimiento (vista HOY). PARTE 1 de 2: enum + columnas.
--
--   Etapas nuevas:   en-contacto, demo-enviada, negociando, reactivacion
--   Columnas nuevas: leads.next_action_at (timestamptz), leads.touch (int)
--
-- IMPORTANTE: los valores de enum nuevos NO se pueden usar en la misma
-- transacción que los agrega (error 55P04 en el SQL Editor de Supabase, que
-- corre el script en UNA transacción). Por eso la migración de DATOS
-- (los UPDATE de filas viejas) vive en la PARTE 2:
--   20260814000001_pipeline_v2_data.sql  → ejecutar DESPUÉS de este archivo.
-- Nota: aunque los UPDATE no se corran, la app normaliza filas legacy al leer
-- (LEGACY_TEMP_MAP en src/lib/constants.ts) — la migración de datos es
-- limpieza opcional.
-- ============================================================================

-- 1. Etapas nuevas del enum (no-op si ya existen).
alter type temperature_t add value if not exists 'en-contacto' after 'nuevo';
alter type temperature_t add value if not exists 'demo-enviada' after 'en-contacto';
alter type temperature_t add value if not exists 'negociando' after 'demo-enviada';
alter type temperature_t add value if not exists 'reactivacion' after 'cliente';

-- 2. Columnas del sistema de seguimiento.
alter table public.leads add column if not exists next_action_at timestamptz;
alter table public.leads add column if not exists touch int not null default 0;
