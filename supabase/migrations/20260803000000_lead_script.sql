-- ============================================================================
-- Guion de llamada por prospecto (Sales Copilot)
-- ----------------------------------------------------------------------------
-- El copilot muestra EN PANTALLA un guion específico por cliente durante la
-- llamada (prioridad sobre el guion genérico Hormozi) y lo inyecta al LLM.
-- Es una columna de la tabla leads existente: hereda sus RLS, no requiere
-- políticas nuevas. Idempotente, seguro de correr varias veces.
-- ============================================================================
alter table public.leads add column if not exists script text not null default '';
