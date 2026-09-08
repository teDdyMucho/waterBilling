-- =====================================================================
--  SCS BILLING PORTAL — Migration 0019
--  READINGS NA WALANG PROPERTY (Unknown / C.O. Subdivision)
--
--  Problema: nakakabasa ang staff ng metro na hindi nila alam kung
--  kaninong bahay, o metro ng subdivision mismo. Hindi ito maitatago sa
--  meter_readings dahil `meter_id` doon ay NOT NULL at kailangang tunay
--  na metro.
--
--  Solusyon: hiwalay na "inbox" — dito napupunta ang litrato at basa.
--  HINDI ito bill at HINDI ito lumalabas sa consumption ng kahit sino
--  hangga't hindi ito itinalaga ng ADMIN sa tamang metro. Ang admin ang
--  nagko-confirm bago ito maging tunay na reading.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0)  Linisin ang naunang bersyon ng 0019 kung na-run ito
--     (gumagawa iyon noon ng espesyal na property — hindi na ginagamit).
--     Buburahin LANG kung wala pang readings na nakasabit dito.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'is_unassigned'
  ) then
    delete from public.meters m
     using public.properties p
     where p.id = m.property_id
       and (p.is_unassigned or p.label = 'C.O. Subdivision')
       and not exists (select 1 from public.meter_readings r where r.meter_id = m.id);

    delete from public.properties p
     where (p.is_unassigned or p.label = 'C.O. Subdivision')
       and not exists (select 1 from public.meters m where m.property_id = p.id);

    alter table public.properties drop column if exists is_unassigned;
    alter table public.properties drop column if exists label;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1)  Ang inbox
-- ---------------------------------------------------------------------
create table if not exists public.unassigned_readings (
  id               uuid primary key default gen_random_uuid(),
  billing_cycle_id uuid not null references public.billing_cycles (id) on delete cascade,
  -- 'unknown'        = hindi alam kung kaninong bahay
  -- 'co_subdivision' = metro ng subdivision mismo (sila ang magbabayad)
  kind             text not null check (kind in ('unknown', 'co_subdivision')),
  utility_type     text not null check (utility_type in ('water', 'electric')),
  -- Kung nabasa ng staff ang serial sa metro — malaking tulong sa admin
  -- para matukoy kung kaninong metro ito.
  meter_number     text,
  previous_reading numeric(12, 2),
  present_reading  numeric(12, 2) not null,
  photo_path       text not null,               -- ⚠️ REQUIRED evidence
  remarks          text,
  read_by          uuid references auth.users (id),
  status           text not null default 'pending'
                     check (status in ('pending', 'assigned', 'discarded')),
  -- Kapag naitalaga na ng admin
  assigned_meter_id   uuid references public.meters (id) on delete set null,
  assigned_reading_id uuid references public.meter_readings (id) on delete set null,
  resolved_by         uuid references auth.users (id),
  resolved_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists unassigned_cycle_idx
  on public.unassigned_readings (billing_cycle_id, status);

drop trigger if exists trg_unassigned_updated_at on public.unassigned_readings;
create trigger trg_unassigned_updated_at
  before update on public.unassigned_readings
  for each row execute function public.set_updated_at();

comment on table public.unassigned_readings is
  'Inbox ng readings na walang metro pa. Ang admin ang nagtatalaga sa tamang metro bago ito maging tunay na reading.';

-- ---------------------------------------------------------------------
-- 2)  RLS — staff/admin lang; admin lang ang makaka-resolve
-- ---------------------------------------------------------------------
alter table public.unassigned_readings enable row level security;

drop policy if exists unassigned_select       on public.unassigned_readings;
drop policy if exists unassigned_insert_staff on public.unassigned_readings;
drop policy if exists unassigned_update_admin on public.unassigned_readings;
drop policy if exists unassigned_delete_admin on public.unassigned_readings;

create policy unassigned_select on public.unassigned_readings for select to authenticated
  using (public.is_staff_or_admin());

create policy unassigned_insert_staff on public.unassigned_readings for insert to authenticated
  with check (public.is_staff_or_admin() and read_by = auth.uid());

create policy unassigned_update_admin on public.unassigned_readings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy unassigned_delete_admin on public.unassigned_readings for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3)  RPC: italaga ng admin sa tunay na metro
--     Gagawa ito ng tunay na meter_reading (dadaan sa compute_reading,
--     kaya kusang makikita ang consumption at anomaly), tapos mamarkahan
--     ang inbox row bilang 'assigned'.
-- ---------------------------------------------------------------------
create or replace function public.assign_unassigned_reading(
  p_id       uuid,
  p_meter_id uuid
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  u        public.unassigned_readings;
  v_meter  public.meters;
  v_new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makakapagtalaga ng reading.' using errcode = '42501';
  end if;

  select * into u from public.unassigned_readings where id = p_id;
  if u.id is null then raise exception 'Wala ang reading na ito.'; end if;
  if u.status <> 'pending' then raise exception 'Naaksyunan na ang reading na ito.'; end if;

  select * into v_meter from public.meters where id = p_meter_id;
  if v_meter.id is null then raise exception 'Wala ang metrong ito.'; end if;
  if v_meter.utility_type <> u.utility_type then
    raise exception 'Hindi tugma ang uri ng metro (% vs %).', v_meter.utility_type, u.utility_type;
  end if;

  if exists (
    select 1 from public.meter_readings
    where meter_id = p_meter_id and billing_cycle_id = u.billing_cycle_id
  ) then
    raise exception 'May reading na ang metrong ito sa cycle na ito.';
  end if;

  insert into public.meter_readings (
    meter_id, billing_cycle_id, previous_reading, present_reading,
    photo_path, remarks, read_by
  ) values (
    p_meter_id, u.billing_cycle_id, u.previous_reading, u.present_reading,
    u.photo_path, u.remarks, u.read_by
  )
  returning id into v_new_id;

  update public.unassigned_readings
     set status              = 'assigned',
         assigned_meter_id   = p_meter_id,
         assigned_reading_id = v_new_id,
         resolved_by         = auth.uid(),
         resolved_at         = now()
   where id = p_id;

  return v_new_id;
end;
$$;

grant execute on function public.assign_unassigned_reading(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4)  RPC: itapon (mali ang basa / doble)
-- ---------------------------------------------------------------------
create or replace function public.discard_unassigned_reading(
  p_id     uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makakapagtapon ng reading.' using errcode = '42501';
  end if;

  update public.unassigned_readings
     set status      = 'discarded',
         remarks     = coalesce(nullif(p_reason, ''), remarks),
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_id and status = 'pending';
end;
$$;

grant execute on function public.discard_unassigned_reading(uuid, text) to authenticated;
