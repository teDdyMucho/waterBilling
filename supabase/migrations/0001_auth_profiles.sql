-- =====================================================================
--  SCS BILLING PORTAL — Migration 0001
--  Phase 1: Auth, Profiles, Roles, RLS
--  Santa Cicilia Subdivision
--
--  PASTE ITO SA:  Supabase Dashboard → SQL Editor → New query → Run
--  Ligtas ulit-ulitin (idempotent).
--
--  Konsepto:
--   - Naka-OFF ang email confirmation (dashboard). Kaya bawat bagong
--     signup ay agad na naka-login PERO status = 'pending'.
--   - Admin ang mag-a-approve (status -> 'active') bago makakita ng data.
--   - Ang seguridad ay nasa RLS (database), hindi sa UI.
--   - "Hindi puwedeng hawakan ng staff ang account ng homeowner" =
--     walang policy ang staff sa profiles maliban sa sarili nila.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0)  Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1)  Table: public.profiles  (1:1 sa auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text,
  full_name          text        not null default '',
  contact_number     text,
  role               text        not null default 'homeowner'
                       check (role in ('admin', 'staff', 'homeowner')),
  status             text        not null default 'pending'
                       check (status in ('pending', 'active', 'suspended', 'rejected')),
  -- Hiniling na Block & Lot sa registration (i-lilink sa property sa Phase 2)
  block              text,
  lot                text,
  preferred_language text        not null default 'tl'
                       check (preferred_language in ('en', 'tl')),
  rejection_reason   text,
  approved_by        uuid references auth.users (id),
  approved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Karagdagang datos ng bawat user; role at status ay dito nakatago.';

create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_role_idx   on public.profiles (role);

-- ---------------------------------------------------------------------
-- 2)  Helper functions (SECURITY DEFINER → hindi nagre-recurse ang RLS)
-- ---------------------------------------------------------------------

-- Ano ang role ng kasalukuyang naka-login?
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Admin ba ang kasalukuyang user?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.get_my_role() to authenticated, anon;
grant execute on function public.is_admin()    to authenticated, anon;

-- ---------------------------------------------------------------------
-- 3)  Trigger: gumawa ng profile row kapag may bagong auth user
--     (kinukuha ang metadata na ipinasa sa signUp options.data)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, contact_number, block, lot, preferred_language,
    role, status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'contact_number',
    new.raw_user_meta_data ->> 'block',
    new.raw_user_meta_data ->> 'lot',
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'tl'),
    'homeowner',   -- lahat ng bagong signup = homeowner
    'pending'      -- kailangan ng admin approval
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4)  Trigger: auto-update ng updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5)  Trigger: protektahan ang privileged na column
--     Ang homeowner/staff ay HINDI puwedeng baguhin ang sariling
--     role / status / approval. Admin lang.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin: walang hadlang
  if public.is_admin() then
    return new;
  end if;

  -- Hindi admin: dapat pareho pa rin ang mga sensitibong field
  if new.id           is distinct from old.id
     or new.role         is distinct from old.role
     or new.status       is distinct from old.status
     or new.approved_by  is distinct from old.approved_by
     or new.approved_at  is distinct from old.approved_at
     or new.email        is distinct from old.email then
    raise exception 'Hindi pinapayagang baguhin ang role/status/approval/email ng profile.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------
-- 6)  Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Linisin muna (para ligtas ulit-ulitin)
drop policy if exists profiles_select_own    on public.profiles;
drop policy if exists profiles_select_admin  on public.profiles;
drop policy if exists profiles_update_own    on public.profiles;
drop policy if exists profiles_update_admin  on public.profiles;
drop policy if exists profiles_delete_admin  on public.profiles;

-- SELECT: nakikita ng user ang SARILING row lang...
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- ...at nakikita ng admin ang LAHAT.
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- UPDATE: puwedeng i-update ng user ang sarili (pero babantayan ng
-- protect_profile_columns ang role/status/etc.)
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- UPDATE: kayang i-update ng admin ang kahit sino (approve/reject/etc.)
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: admin lang (bihira; karaniwan ay 'suspended' na lang)
create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- NOTA: WALANG INSERT policy — ang paggawa ng profile ay sa trigger lang
-- (handle_new_user, security definer). At WALANG policy ang staff sa ibang
-- rows → dito ipinatutupad ang "bawal hawakan ng staff ang account ng homeowner".

-- ---------------------------------------------------------------------
-- 7)  (Opsyonal) Realtime — para sa live na pending list ng admin
-- ---------------------------------------------------------------------
-- Idagdag lang kung wala pa
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- =====================================================================
--  TAPOS ang 0001. I-run ang 0002 sunod para gawing admin ang sarili mo.
-- =====================================================================
