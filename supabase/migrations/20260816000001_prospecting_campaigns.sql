-- Prospección automática diaria: campañas configurables por el fundador.
-- Una campaña = nicho + ciudad + cuántos/día + umbrales por servicio + a quién
-- asignar. El scheduler (Fase 4) ejecuta las campañas `active` cada mañana.
create table if not exists public.prospecting_campaigns (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id),
  name            text not null default '',
  niche           text not null,
  location        text not null,
  limit_per_day   int  not null default 30,
  thresholds      jsonb not null default '{"web":70,"aaas":70}',
  assigned_to     uuid not null references public.profiles(id),
  active          boolean not null default true,
  demo_agent_url  text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.prospecting_campaigns enable row level security;

drop policy if exists "campaigns read" on public.prospecting_campaigns;
create policy "campaigns read" on public.prospecting_campaigns for select
  using (public.is_admin() or owner_id = auth.uid());

drop policy if exists "campaigns write" on public.prospecting_campaigns;
create policy "campaigns write" on public.prospecting_campaigns for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
