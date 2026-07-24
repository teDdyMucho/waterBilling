-- =====================================================================
--  SCS BILLING PORTAL — Migration 0004
--  Phase 2: Properties, Meters, Property-Owner links
--
--  I-run PAGKATAPOS ng 0001. Ligtas ulit-ulitin (idempotent).
--
--  Konsepto:
--   - properties      = mga lote (block / lot / phase)
--   - meters          = metro ng tubig at kuryente kada property
--   - property_owners = link ng homeowner (profiles) sa property nila
--   - Admin lang ang makakapag-edit. Staff = tingin lang (read-only).
--     Homeowner = sariling property lang. Ipinatutupad sa RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Helper: staff o admin ba? (SECURITY DEFINER, hindi nagre-recurse)
-- ---------------------------------------------------------------------
create or replace function public.is_staff_or_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role in ('staff', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_staff_or_admin() to authenticated, anon;

-- ---------------------------------------------------------------------
-- 2)  Table: properties
-- ---------------------------------------------------------------------
create table if not exists public.properties (
  id            uuid primary key default gen_random_uuid(),
  block         text not null,
  lot           text not null,
  phase         text,
  address_line  text,
  assigned_zone text,
  status        text not null default 'occupied'
                  check (status in ('occupied', 'vacant', 'inactive')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Isang lote lang kada (phase, block, lot)
create unique index if not exists properties_unique_lot
  on public.properties (coalesce(phase, ''), block, lot);
create index if not exists properties_status_idx on public.properties (status);

drop trigger if exists trg_properties_updated_at on public.properties;
create trigger trg_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3)  Table: meters (tubig / kuryente)
-- ---------------------------------------------------------------------
create table if not exists public.meters (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties (id) on delete cascade,
  utility_type      text not null check (utility_type in ('water', 'electric')),
  meter_number      text,
  initial_reading   numeric(12, 2) not null default 0,
  digits            int not null default 5,
  status            text not null default 'active'
                      check (status in ('active', 'replaced', 'inactive')),
  replaced_meter_id uuid references public.meters (id),
  installed_at      date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Isang ACTIVE na metro lang kada utility kada property
create unique index if not exists meters_one_active_per_utility
  on public.meters (property_id, utility_type)
  where status = 'active';
create index if not exists meters_property_idx on public.meters (property_id);
-- Kung may meter number, dapat unique (huwag pansinin ang NULL)
create unique index if not exists meters_number_unique
  on public.meters (meter_number)
  where meter_number is not null;

drop trigger if exists trg_meters_updated_at on public.meters;
create trigger trg_meters_updated_at
  before update on public.meters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4)  Table: property_owners (link homeowner ↔ property)
-- ---------------------------------------------------------------------
create table if not exists public.property_owners (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  is_primary  boolean not null default true,
  start_date  date not null default current_date,
  end_date    date,
  created_at  timestamptz not null default now()
);

-- Isang aktibong link lang kada homeowner kada property
create unique index if not exists property_owners_active_link
  on public.property_owners (property_id, profile_id)
  where end_date is null;
create index if not exists property_owners_profile_idx on public.property_owners (profile_id);

-- ---------------------------------------------------------------------
-- 5)  Helper: pag-aari ba ng kasalukuyang user ang property?
-- ---------------------------------------------------------------------
create or replace function public.owns_property(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.property_owners
    where property_id = p_id
      and profile_id = auth.uid()
      and end_date is null
  );
$$;
grant execute on function public.owns_property(uuid) to authenticated, anon;

-- =====================================================================
-- 6)  Row Level Security
-- =====================================================================
alter table public.properties      enable row level security;
alter table public.meters          enable row level security;
alter table public.property_owners enable row level security;

-- ---- properties -----------------------------------------------------
drop policy if exists properties_select     on public.properties;
drop policy if exists properties_write_admin on public.properties;

-- SELECT: staff/admin = lahat; homeowner = sariling property lang
create policy properties_select on public.properties for select to authenticated
  using (public.is_staff_or_admin() or public.owns_property(id));

-- INSERT/UPDATE/DELETE: admin lang
create policy properties_write_admin on public.properties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- meters ---------------------------------------------------------
drop policy if exists meters_select      on public.meters;
drop policy if exists meters_write_admin on public.meters;

create policy meters_select on public.meters for select to authenticated
  using (public.is_staff_or_admin() or public.owns_property(property_id));

create policy meters_write_admin on public.meters for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- property_owners ------------------------------------------------
drop policy if exists property_owners_select      on public.property_owners;
drop policy if exists property_owners_write_admin on public.property_owners;

create policy property_owners_select on public.property_owners for select to authenticated
  using (public.is_staff_or_admin() or profile_id = auth.uid());

create policy property_owners_write_admin on public.property_owners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 7)  Convenience VIEW — homeowners na puwedeng i-link (para sa admin UI)
--     Ipinapakita lang ang role='homeowner'. Protektado pa rin ng RLS
--     ng profiles (admin lang ang nakakakita ng iba).
-- =====================================================================
create or replace view public.homeowner_directory as
  select id, full_name, email, contact_number, block, lot, status
  from public.profiles
  where role = 'homeowner';

-- =====================================================================
--  TAPOS ang 0004. Sa app, pumunta sa Admin → Lote at Metro.
-- =====================================================================
