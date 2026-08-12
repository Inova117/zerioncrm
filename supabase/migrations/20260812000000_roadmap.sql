-- ============================================================================
-- Roadmap Zerion (Guía Diaria V1) — módulo personal del fundador (12 semanas)
-- ----------------------------------------------------------------------------
-- 5 tablas con owner_id. RLS "solo el dueño": el módulo es personal de Martín
-- (admin id 117mgd…); no usa is_admin(), así que NI los empleados NI otros
-- admins ven estos datos. Sigue el patrón de copilot_memory (policy "own").
-- Espejo en supabase/schema.sql (NOTA #26: editar ambos).
-- ============================================================================

-- Diario: captura diaria, fuente de verdad (hoja DIARIO del Excel) ------------
create table if not exists public.roadmap_days (
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  contacts    int not null default 0,
  demos       int not null default 0,
  webs        int not null default 0,
  aaas        int not null default 0,
  income      numeric not null default 0,
  content     boolean not null default false,
  notes       text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (owner_id, day)
);

-- Actividades del roadmap (hoja ROADMAP: 16 filas, 2 gates) ------------------
create table if not exists public.roadmap_activities (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  week        int not null,
  phase       text not null,
  title       text not null,
  responsible text not null default 'Martin',
  due_date    date,
  status      text not null default 'pendiente',
  is_gate     boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists roadmap_activities_owner_idx on public.roadmap_activities(owner_id, week, sort);

-- Clientes con mensualidad (hoja FINANZAS → MRR actual) ----------------------
create table if not exists public.roadmap_clients (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  product     text not null default 'web',
  start_date  date,
  setup       numeric not null default 0,
  monthly     numeric not null default 0,
  status      text not null default 'activo',
  notes       text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists roadmap_clients_owner_idx on public.roadmap_clients(owner_id);

-- Caja: ingresos y egresos (hoja FINANZAS → CAJA) ----------------------------
create table if not exists public.roadmap_cash (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  day         date not null default now()::date,
  concept     text not null default '',
  income      numeric not null default 0,
  expense     numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists roadmap_cash_owner_idx on public.roadmap_cash(owner_id, day desc);

-- Meta del módulo: metas mensuales, pitch, reserva, planStart -----------------
create table if not exists public.roadmap_meta (
  owner_id    uuid primary key references public.profiles(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.roadmap_days       enable row level security;
alter table public.roadmap_activities enable row level security;
alter table public.roadmap_clients    enable row level security;
alter table public.roadmap_cash       enable row level security;
alter table public.roadmap_meta       enable row level security;

drop policy if exists "roadmap_days own"       on public.roadmap_days;
create policy "roadmap_days own"       on public.roadmap_days       for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "roadmap_activities own" on public.roadmap_activities;
create policy "roadmap_activities own" on public.roadmap_activities for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "roadmap_clients own"    on public.roadmap_clients;
create policy "roadmap_clients own"    on public.roadmap_clients    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "roadmap_cash own"       on public.roadmap_cash;
create policy "roadmap_cash own"       on public.roadmap_cash       for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "roadmap_meta own"       on public.roadmap_meta;
create policy "roadmap_meta own"       on public.roadmap_meta       for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
