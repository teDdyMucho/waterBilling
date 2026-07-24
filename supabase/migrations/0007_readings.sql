-- =====================================================================
--  SCS BILLING PORTAL — Migration 0007
--  Phase 3: Billing Cycles, Meter Readings (may REQUIRED photo),
--           auto-compute ng konsumo + anomaly detection, photo storage
--
--  I-run PAGKATAPOS ng 0001 + 0004. Ligtas ulit-ulitin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  billing_cycles — buwanang panahon ng pagsingil
-- ---------------------------------------------------------------------
create table if not exists public.billing_cycles (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- hal. '2026-08'
  reading_start date,
  reading_end   date,
  bill_date     date,
  due_date      date,
  grace_days    int  not null default 5,
  status        text not null default 'open'
                  check (status in ('open', 'reading', 'billed', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_cycles_updated_at on public.billing_cycles;
create trigger trg_cycles_updated_at
  before update on public.billing_cycles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2)  meter_readings — REQUIRED ang photo (photo_path NOT NULL)
-- ---------------------------------------------------------------------
create table if not exists public.meter_readings (
  id               uuid primary key default gen_random_uuid(),
  meter_id         uuid not null references public.meters (id) on delete cascade,
  billing_cycle_id uuid not null references public.billing_cycles (id) on delete cascade,
  previous_reading numeric(12, 2) not null default 0,
  present_reading  numeric(12, 2) not null,
  consumption      numeric(12, 2) generated always as (present_reading - previous_reading) stored,
  photo_path       text not null,               -- ⚠️ REQUIRED evidence
  photo_taken_at   text,
  read_by          uuid references auth.users (id),
  read_at          timestamptz,
  status           text not null default 'draft'
                     check (status in ('draft', 'for_review', 'verified', 'rejected')),
  remarks          text,
  is_anomaly       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Isang reading lang kada metro kada cycle
  unique (meter_id, billing_cycle_id)
);

create index if not exists readings_cycle_idx on public.meter_readings (billing_cycle_id);
create index if not exists readings_meter_idx on public.meter_readings (meter_id);

drop trigger if exists trg_readings_updated_at on public.meter_readings;
create trigger trg_readings_updated_at
  before update on public.meter_readings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3)  Helper: naunang reading ng isang metro
--     (huling reading, o initial_reading kung wala pa)
-- ---------------------------------------------------------------------
create or replace function public.get_previous_reading(p_meter_id uuid)
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (
      select mr.present_reading
      from public.meter_readings mr
      where mr.meter_id = p_meter_id
        and mr.status in ('verified', 'for_review')
      order by mr.created_at desc
      limit 1
    ),
    (select initial_reading from public.meters where id = p_meter_id),
    0
  );
$$;
grant execute on function public.get_previous_reading(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4)  Trigger: auto-fill previous, compute anomaly + status
--     Anomaly kung: negatibo, zero, o >200% ng 3-cycle average.
-- ---------------------------------------------------------------------
create or replace function public.compute_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev numeric;
  v_avg  numeric;
  v_cons numeric;
begin
  if TG_OP = 'INSERT' then
    -- Server-authoritative ang previous (hindi puwedeng i-tamper)
    v_prev := public.get_previous_reading(NEW.meter_id);
    NEW.previous_reading := v_prev;
    NEW.read_at := coalesce(NEW.read_at, now());
  end if;

  v_cons := NEW.present_reading - NEW.previous_reading;

  select avg(c) into v_avg from (
    select consumption as c
    from public.meter_readings
    where meter_id = NEW.meter_id
      and status = 'verified'
      and id <> NEW.id
    order by created_at desc
    limit 3
  ) t;

  NEW.is_anomaly := (
    v_cons < 0
    or v_cons = 0
    or (v_avg is not null and v_avg > 0 and v_cons > v_avg * 2)
  );

  -- Sa INSERT lang itakda ang status (para hindi ma-override ang admin verify)
  if TG_OP = 'INSERT' then
    NEW.status := case when NEW.is_anomaly then 'for_review' else 'verified' end;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_compute_reading on public.meter_readings;
create trigger trg_compute_reading
  before insert or update on public.meter_readings
  for each row execute function public.compute_reading();

-- ---------------------------------------------------------------------
-- 5)  Helper: pag-aari ba ng user ang metro? (para sa homeowner RLS)
-- ---------------------------------------------------------------------
create or replace function public.owns_meter(p_meter_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.meters m
    where m.id = p_meter_id and public.owns_property(m.property_id)
  );
$$;
grant execute on function public.owns_meter(uuid) to authenticated;

-- =====================================================================
-- 6)  RLS
-- =====================================================================
alter table public.billing_cycles enable row level security;
alter table public.meter_readings enable row level security;

-- ---- billing_cycles -------------------------------------------------
drop policy if exists cycles_select      on public.billing_cycles;
drop policy if exists cycles_write_admin on public.billing_cycles;

create policy cycles_select on public.billing_cycles for select to authenticated
  using (true);  -- lahat ng naka-login (kailangan ng homeowner para sa bill context)

create policy cycles_write_admin on public.billing_cycles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- meter_readings -------------------------------------------------
drop policy if exists readings_select        on public.meter_readings;
drop policy if exists readings_insert_staff  on public.meter_readings;
drop policy if exists readings_update_staff  on public.meter_readings;
drop policy if exists readings_update_admin  on public.meter_readings;
drop policy if exists readings_delete_admin  on public.meter_readings;

-- SELECT: staff/admin = lahat; homeowner = sariling metro lang
create policy readings_select on public.meter_readings for select to authenticated
  using (public.is_staff_or_admin() or public.owns_meter(meter_id));

-- INSERT: staff/admin (dapat sila ang read_by)
create policy readings_insert_staff on public.meter_readings for insert to authenticated
  with check (public.is_staff_or_admin() and read_by = auth.uid());

-- UPDATE: staff sa sariling na-encode; admin sa lahat (verify/reject)
create policy readings_update_staff on public.meter_readings for update to authenticated
  using (read_by = auth.uid() and public.get_my_role() = 'staff')
  with check (read_by = auth.uid());

create policy readings_update_admin on public.meter_readings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- DELETE: admin lang
create policy readings_delete_admin on public.meter_readings for delete to authenticated
  using (public.is_admin());

-- =====================================================================
-- 7)  Storage bucket: meter-photos (PRIVATE) + policies
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('meter-photos', 'meter-photos', false)
on conflict (id) do nothing;

-- Path convention: {cycle_code}/{meter_id}/{uuid}.jpg
--   → foldername(name)[2] = meter_id

drop policy if exists meterphotos_staff_all on storage.objects;
drop policy if exists meterphotos_owner_read on storage.objects;

-- Staff/admin: buong access sa bucket
create policy meterphotos_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'meter-photos' and public.is_staff_or_admin())
  with check (bucket_id = 'meter-photos' and public.is_staff_or_admin());

-- Homeowner: mabasa lang ang litrato ng SARILING metro
create policy meterphotos_owner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'meter-photos'
    and public.owns_meter(((storage.foldername(name))[2])::uuid)
  );

-- =====================================================================
--  TAPOS ang 0007. Sa app: Admin → magbukas ng cycle; Staff → mag-encode.
-- =====================================================================
