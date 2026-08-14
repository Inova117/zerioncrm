-- ============================================================================
-- Pipeline v2 (ago 2026): etapas = PRÓXIMA ACCIÓN con fecha + sistema de
-- seguimiento (vista HOY).
--
--   Etapas nuevas:   en-contacto, demo-enviada, negociando, reactivacion
--   Etapas viejas:   frio→en-contacto, tibio→en-contacto,
--                    caliente→negociando, reunion→negociando,
--                    no-acepto→reactivacion  (los valores legacy quedan en el
--                    enum; PG no permite borrarlos)
--   Columnas nuevas: leads.next_action_at (timestamptz, la fecha del próximo
--                    toque) y leads.touch (int, número del próximo toque)
--
-- Idempotente: seguro de re-correr en bases ya migradas.
-- ============================================================================

-- 1. Etapas nuevas del enum (no-op si ya existen).
alter type temperature_t add value if not exists 'en-contacto' after 'nuevo';
alter type temperature_t add value if not exists 'demo-enviada' after 'en-contacto';
alter type temperature_t add value if not exists 'negociando' after 'demo-enviada';
alter type temperature_t add value if not exists 'reactivacion' after 'cliente';

-- 2. Columnas del sistema de seguimiento.
alter table public.leads add column if not exists next_action_at timestamptz;
alter table public.leads add column if not exists touch int not null default 0;

-- 3. Migrar filas existentes a las etapas v2 (no-op si no quedan viejas).
update public.leads set temperature = 'en-contacto'  where temperature in ('frio', 'tibio');
update public.leads set temperature = 'negociando'   where temperature in ('caliente', 'reunion');
update public.leads set temperature = 'reactivacion' where temperature = 'no-acepto';
