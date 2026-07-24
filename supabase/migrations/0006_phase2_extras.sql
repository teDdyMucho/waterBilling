-- =====================================================================
--  SCS BILLING PORTAL — Migration 0006
--  Phase 2 extras: staff zone, meter replacement (atomic)
--
--  I-run PAGKATAPOS ng 0001 + 0004. Ligtas ulit-ulitin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Zone column sa profiles (para sa assignment ng staff)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists zone text;

-- I-protektahan din ang zone — admin lang ang makakapagtakda.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;  -- admin: walang hadlang
  end if;

  if new.id           is distinct from old.id
     or new.role         is distinct from old.role
     or new.status       is distinct from old.status
     or new.approved_by  is distinct from old.approved_by
     or new.approved_at  is distinct from old.approved_at
     or new.email        is distinct from old.email
     or new.zone         is distinct from old.zone then
    raise exception 'Hindi pinapayagang baguhin ang role/status/approval/email/zone ng profile.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2)  RPC: replace_meter — atomic na pagpapalit ng metro
--     (markahan ang luma bilang 'replaced', gumawa ng bagong active)
-- ---------------------------------------------------------------------
create or replace function public.replace_meter(
  p_old_meter_id uuid,
  p_new_number   text,
  p_new_initial  numeric,
  p_new_digits   int,
  p_installed    date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property uuid;
  v_utility  text;
  v_new      uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makakapag-replace ng metro.' using errcode = '42501';
  end if;

  select property_id, utility_type into v_property, v_utility
  from public.meters where id = p_old_meter_id;

  if v_property is null then
    raise exception 'Walang ganitong metro.';
  end if;

  -- Markahan ang luma (para hindi lumabag sa isang-active-kada-utility)
  update public.meters set status = 'replaced' where id = p_old_meter_id;

  -- Gumawa ng bagong active na metro
  insert into public.meters (
    property_id, utility_type, meter_number, initial_reading, digits,
    status, replaced_meter_id, installed_at
  )
  values (
    v_property, v_utility, nullif(p_new_number, ''),
    coalesce(p_new_initial, 0), coalesce(p_new_digits, 5),
    'active', p_old_meter_id, p_installed
  )
  returning id into v_new;

  return v_new;
end;
$$;

grant execute on function public.replace_meter(uuid, text, numeric, int, date) to authenticated;

-- =====================================================================
--  TAPOS ang 0006.
-- =====================================================================
