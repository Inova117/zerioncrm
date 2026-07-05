-- ============================================================================
-- Zerion CRM — Supabase schema + Row Level Security  (IDEMPOTENTE)
-- ----------------------------------------------------------------------------
-- Este script es SEGURO de correr varias veces, incluso si una corrida previa
-- se aplicó a medias (p. ej. por el "Failed to fetch" durante un incidente).
-- No falla con "type ... already exists" ni "relation ... already exists".
--
-- Cómo usarlo: pégalo completo en el SQL Editor de Supabase y dale Run.
-- Al terminar, verifica con las consultas del final de este archivo.
--
-- Seguridad: los registros en Auth deben crearse SOLO por el admin (desactiva
-- "Enable sign ups" en Authentication → Providers → Email). Ver README.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Enum types -----------------------------------------------------------------
-- (envueltos en DO/EXCEPTION para que un re-run no truene si ya existen)
do $$ begin
  create type role_t as enum ('admin','employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type temperature_t as enum ('nuevo','frio','tibio','caliente','reunion','cliente','perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_t as enum ('linkedin','instagram','email','whatsapp','referido','web','evento','llamada','otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cadence_t as enum ('daily','weekly','monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_t as enum ('comment','stage_change','contact','meeting');
exception when duplicate_object then null; end $$;

-- Profiles (1:1 con auth.users) ----------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text not null unique,
  name         text not null,
  role         role_t not null default 'employee',
  avatar_color text not null default '#6366f1',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Leads ----------------------------------------------------------------------
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  company         text not null,
  contact_name    text default '',
  role            text default '',
  email           text default '',
  phone           text default '',
  website         text default '',
  industry        text default '',
  source          source_t not null default 'otro',
  channel         text default '',
  reason          text default '',
  temperature     temperature_t not null default 'nuevo',
  value           numeric not null default 0,
  position        int not null default 0,
  assigned_to     uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_contact_at timestamptz,
  meeting_at      timestamptz
);
create index if not exists leads_assigned_idx    on public.leads(assigned_to);
create index if not exists leads_temperature_idx on public.leads(temperature);

-- Comments / activity --------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  author_id  uuid not null references public.profiles(id),
  type       activity_t not null default 'comment',
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_lead_idx on public.comments(lead_id);

-- Tasks ----------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  notes        text default '',
  cadence      cadence_t not null default 'daily',
  done         boolean not null default false,
  assigned_to  uuid not null references public.profiles(id),
  lead_id      uuid references public.leads(id) on delete set null,
  due_date     timestamptz,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_assigned_idx on public.tasks(assigned_to);

-- ---------------------------------------------------------------------------
-- Helper: ¿el usuario actual es admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--   * Admin: lectura/escritura total.
--   * Empleado: solo las filas asignadas a él.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leads    enable row level security;
alter table public.comments enable row level security;
alter table public.tasks    enable row level security;

-- profiles
drop policy if exists "profiles read"        on public.profiles;
create policy "profiles read"        on public.profiles for select using (auth.role() = 'authenticated');
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for all   using (public.is_admin()) with check (public.is_admin());

-- leads
drop policy if exists "leads read"   on public.leads;
create policy "leads read"   on public.leads for select
  using (public.is_admin() or assigned_to = auth.uid());
drop policy if exists "leads insert" on public.leads;
create policy "leads insert" on public.leads for insert
  with check (public.is_admin() or assigned_to = auth.uid());
drop policy if exists "leads update" on public.leads;
create policy "leads update" on public.leads for update
  using (public.is_admin() or assigned_to = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid());
drop policy if exists "leads delete" on public.leads;
create policy "leads delete" on public.leads for delete
  using (public.is_admin() or assigned_to = auth.uid());

-- comments
drop policy if exists "comments read"   on public.comments;
create policy "comments read"   on public.comments for select
  using (public.is_admin() or exists (
    select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()));
drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and (public.is_admin() or l.assigned_to = auth.uid())
    )
  );
drop policy if exists "comments delete" on public.comments;
create policy "comments delete" on public.comments for delete
  using (public.is_admin() or author_id = auth.uid());

-- tasks
drop policy if exists "tasks read"   on public.tasks;
create policy "tasks read"   on public.tasks for select
  using (public.is_admin() or assigned_to = auth.uid());
drop policy if exists "tasks insert" on public.tasks;
create policy "tasks insert" on public.tasks for insert
  with check (public.is_admin() or assigned_to = auth.uid());
drop policy if exists "tasks update" on public.tasks;
create policy "tasks update" on public.tasks for update
  using (public.is_admin() or assigned_to = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid());
drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks for delete
  using (public.is_admin() or assigned_to = auth.uid());

-- ---------------------------------------------------------------------------
-- Mantener updated_at fresco en leads
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- VERIFICACIÓN — corre esto después para confirmar que todo quedó bien:
--
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by 1;
--   -- Debe listar: comments, leads, profiles, tasks
--
--   select count(*) as policies from pg_policies where schemaname = 'public';
--   -- Debe dar: 13
-- ============================================================================
