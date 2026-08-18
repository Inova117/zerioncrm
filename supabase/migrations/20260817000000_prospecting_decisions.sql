-- Log de decisiones del sistema autónomo de prospección (Fase D).
-- Cada mañana el decisor registra qué nicho+ciudad eligió, por qué y cuánto
-- trajo, para el panel "Prospección de hoy" y el historial de decisiones.
-- Escritura SOLO por la Edge Function (service_role); lectura del admin.
create table if not exists public.prospecting_decisions (
  id           uuid primary key default gen_random_uuid(),
  niche        text not null,
  city         text not null,
  service      text not null default 'web',  -- web | aaas (informativo)
  priority     int  not null default 50,
  reason       text not null default '',
  found        int  not null default 0,
  created      int  not null default 0,
  discoveries  int  not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.prospecting_decisions enable row level security;

drop policy if exists "decisions read" on public.prospecting_decisions;
create policy "decisions read" on public.prospecting_decisions for select
  using (public.is_admin());