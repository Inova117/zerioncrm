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
--
-- NOTA (#26): este archivo y supabase/migrations/20260704000000_init.sql son
--   ESPEJOS; si editas uno, edita el otro (schema.sql = pegar en el editor SQL;
--   migrations = flujo CLI `supabase db push`).
-- NOTA (#24): leads.position no tiene lógica de "siguiente posición" en el
--   servidor; el cliente asigna max(position)+1 al crear (igual que el mock). Si
--   insertas leads por SQL directo, setea position explícitamente para no colisionar.
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
  create type source_t as enum ('linkedin','instagram','email','whatsapp','referido','web','evento','llamada','scraper','otro');
exception when duplicate_object then null; end $$;

-- Parche idempotente: agrega 'scraper' a source_t en BDs ya creadas sin ese valor
-- (integración ZerionScraperAI → CRM). ADD VALUE IF NOT EXISTS es no-op si ya existe.
alter type source_t add value if not exists 'scraper';

do $$ begin
  create type cadence_t as enum ('daily','weekly','monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_t as enum ('comment','stage_change','contact','meeting');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_t as enum ('web','app','ecommerce','branding','marketing','mantenimiento','consultoria','otro');
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
  service         service_t not null default 'otro',
  value           numeric not null default 0,
  mrr             numeric not null default 0,
  position        int not null default 0,
  assigned_to     uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_contact_at timestamptz,
  meeting_at      timestamptz,
  enrichment      jsonb
);

-- Enriquecimiento del scraper (rating, ciudad, segmento, whatsapp, score) para
-- BDs ya creadas. Alimenta las tarjetas del Lead Finder. (integración ScraperAI)
alter table public.leads add column if not exists enrichment jsonb;
create index if not exists leads_assigned_idx    on public.leads(assigned_to);
create index if not exists leads_temperature_idx on public.leads(temperature);
-- For DBs where the leads table already exists (create-if-not-exists won't alter it):
alter table public.leads add column if not exists service service_t not null default 'otro';
alter table public.leads add column if not exists mrr numeric not null default 0;

-- Comments / activity --------------------------------------------------------
-- author_id is ON DELETE SET NULL: deleting an ex-employee must not be blocked by
-- their past comments; the history stays and the UI shows "Usuario eliminado". (#17)
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  type       activity_t not null default 'comment',
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_lead_idx on public.comments(lead_id);
-- For DBs where the table already exists (create-if-not-exists won't alter it):
alter table public.comments alter column author_id drop not null;
do $$ begin
  alter table public.comments drop constraint if exists comments_author_id_fkey;
  alter table public.comments add constraint comments_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete set null;
exception when others then null; end $$;

-- NOTE: leads.assigned_to and tasks.assigned_to are NOT NULL with the default
-- ON DELETE (RESTRICT) on purpose: you must REASSIGN a user's leads/tasks before
-- deleting them (the app / Edge Function does this), so a delete can never orphan
-- rows with an invalid owner. (bug #17 companion)

-- Contacts (people/stakeholders at an account) ------------------------------
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  name       text not null,
  role       text default '',
  email      text default '',
  phone      text default '',
  created_at timestamptz not null default now()
);
create index if not exists contacts_lead_idx on public.contacts(lead_id);

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
  completed_at timestamptz,
  recurring    boolean not null default false,
  target       numeric not null default 0,
  progress     numeric not null default 0,
  period_key   text
);
create index if not exists tasks_assigned_idx on public.tasks(assigned_to);
-- For DBs where the tasks table already exists (create-if-not-exists won't alter it):
alter table public.tasks add column if not exists recurring  boolean not null default false;
alter table public.tasks add column if not exists target     numeric not null default 0;
alter table public.tasks add column if not exists progress   numeric not null default 0;
alter table public.tasks add column if not exists period_key text;

-- Lead Finder searches (async Apify jobs) ------------------------------------
-- One row per "Buscar leads". The Edge Function starts an Apify run, records it
-- here, and the app polls until status=done. Escrituras SOLO por la Edge
-- Function (service_role); el usuario únicamente lee las suyas.
create table if not exists public.lead_searches (
  id            uuid primary key default gen_random_uuid(),
  apify_run_id  text,
  requested_by  uuid not null references public.profiles(id),
  assigned_to   uuid not null references public.profiles(id),
  business_type text not null,
  location      text not null,
  status        text not null default 'running', -- running | ingesting | done | failed
  error         text,
  found         int not null default 0,
  inserted      int not null default 0,
  duplicates    int not null default 0,
  no_website    int not null default 0,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists lead_searches_by_idx on public.lead_searches(requested_by);

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
alter table public.contacts enable row level security;
alter table public.comments enable row level security;
alter table public.tasks    enable row level security;
alter table public.lead_searches enable row level security;

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

-- contacts: readable/writable by admin or the owner of the parent lead
drop policy if exists "contacts read"  on public.contacts;
create policy "contacts read"  on public.contacts for select
  using (public.is_admin() or exists (
    select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()));
drop policy if exists "contacts write" on public.contacts;
create policy "contacts write" on public.contacts for all
  using (public.is_admin() or exists (
    select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()));

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

-- lead_searches: cada quien lee sus búsquedas (admin todas). Escritura solo por
-- la Edge Function (service_role) — sin policy de write para authenticated.
drop policy if exists "lead_searches read" on public.lead_searches;
create policy "lead_searches read" on public.lead_searches for select
  using (public.is_admin() or requested_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Mantener updated_at fresco en leads
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- GRANTS (CRÍTICO) — sin esto PostgREST devuelve "42501 permission denied".
-- Toda la app corre autenticada; RLS filtra las filas. anon no necesita nada
-- (el login usa la Auth API, no la REST API).
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- Que las tablas/funciones FUTURAS también hereden el grant:
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- ---------------------------------------------------------------------------
-- Al crear un usuario en Auth (dashboard o Edge Function) se crea su perfil
-- automáticamente. El rol/nombre/color salen de user_metadata. (Cuentas SOLO por
-- el admin: recuerda desactivar "Enable sign ups" en Auth → Providers → Email.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role, avatar_color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::role_t, 'employee'),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#6366f1')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- VERIFICACIÓN — corre esto después para confirmar que todo quedó bien:
--
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by 1;
--   -- Debe listar: comments, contacts, leads, profiles, tasks
--
--   select count(*) as policies from pg_policies where schemaname = 'public';
--   -- Debe dar: 15
-- ============================================================================
