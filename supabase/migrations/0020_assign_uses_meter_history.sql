-- =====================================================================
--  SCS BILLING PORTAL — Migration 0020
--  AYUSIN: ang previous reading ng naitalagang Unknown / C.O.
--
--  Bug sa 0019: kinokopya ng assign_unassigned_reading ang previous_reading
--  na ipinasok ng staff. Pero sa Unknown, HINDI alam ng staff kung aling
--  metro iyon — hula lang ang halagang iyon (kadalasan 0). Kapag naitalaga,
--  nagiging basehan ito ng singil:
--
--      consumption = present - previous
--
--  Kaya ang metrong nasa 1200 na, kapag inilagay bilang previous = 0,
--  sisingilin sa BUONG 1250 imbes na 50. Malaking maling bill.
--
--  Ayos: huwag nang ipasa ang previous. Kapag NULL, ang trigger na
--  compute_reading (migration 0018) ang kukuha ng HULING BASA ng metrong
--  iyon — na siyang tamang basehan, dahil alam na natin ngayon kung aling
--  metro ito.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

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
    p_meter_id, u.billing_cycle_id,
    -- NULL = ang huling basa ng metrong ito ang gagamitin (0018 trigger),
    -- hindi ang hula ng staff.
    null,
    u.present_reading,
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
