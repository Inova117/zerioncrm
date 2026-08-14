-- ============================================================================
-- Pipeline v2 — PARTE 2 de 2: migración de DATOS (filas viejas → etapas v2).
-- Ejecutar DESPUÉS de 20260814000000_pipeline_v2.sql (los valores de enum
-- nuevos deben estar commiteados antes de usarse — error 55P04 si van juntos
-- en la misma transacción del SQL Editor).
--
--   frio/tibio      → en-contacto
--   caliente/reunion → negociando
--   no-acepto       → reactivacion
--
-- Idempotente: re-ejecutar es no-op (no quedan filas con etapas viejas).
-- ============================================================================

update public.leads set temperature = 'en-contacto'  where temperature in ('frio', 'tibio');
update public.leads set temperature = 'negociando'   where temperature in ('caliente', 'reunion');
update public.leads set temperature = 'reactivacion' where temperature = 'no-acepto';
