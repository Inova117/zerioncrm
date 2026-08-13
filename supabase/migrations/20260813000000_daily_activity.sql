-- ============================================================================
-- daily_activity: check-in diario del vendedor (supervisión del equipo)
-- Un registro por vendedor y día. RLS: cada quien escribe SOLO su día; el
-- admin lee/edita todo (supervisión). El dueño del lead NO aplica aquí: es
-- actividad personal del vendedor.
-- ============================================================================
create table if not exists public.daily_activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  calls      int  not null default 0,
  contacts   int  not null default 0,
  demos      int  not null default 0,
  closes     int  not null default 0,
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists daily_activity_user_day_idx on public.daily_activity(user_id, day desc);

alter table public.daily_activity enable row level security;

drop policy if exists "daily_activity self" on public.daily_activity;
create policy "daily_activity self" on public.daily_activity for all
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());
