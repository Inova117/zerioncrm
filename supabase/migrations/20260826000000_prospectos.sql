-- Minero de Prospectos del fundador (sistema personal de outreach, solo él).
-- owner_id = auth.uid() (NO is_admin): ni empleados NI otros admins lo ven.
-- Espejo en supabase/schema.sql (sección "Minero de Prospectos del fundador").
-- Pro-tip (deploy): pegar este SQL en el editor de Supabase, NO db push, para no
-- arrastrar migraciones WIP ajenas (patrón acordado con Martín).

create table if not exists public.prospectos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  company     text not null,
  segment     text not null default 'otro',
  city        text not null default 'Quito',
  pais        text not null default 'Ecuador',
  size        text,
  website     text,
  contact     jsonb not null default '{}'::jsonb,
  score       numeric not null default 0,
  temperatura text not null default 'tibio',
  objetivo    boolean not null default true,
  gap         text,
  notas       text,
  technical   jsonb,
  source      text not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists prospectos_owner_idx on public.prospectos(owner_id, score desc);

alter table public.prospectos enable row level security;
drop policy if exists "prospectos own" on public.prospectos;
create policy "prospectos own" on public.prospectos for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
