-- =====================================================================
--  SCS BILLING PORTAL — Migration 0027
--  PUWEDE NANG WALANG CYCLE ANG UNKNOWN / C.O.
--
--  Bakit: mula sa 0026, ang billing cycle ay pag-aari na ng ISANG property.
--  Ang basang "Unknown" ay walang alam na property — kaya wala rin itong
--  masasabing cycle. Ang dating pagpilit ng cycle ay nangangahulugang
--  naikakabit ito sa cycle ng ibang homeowner, na mali.
--
--  Ngayon: NULL ang billing_cycle_id hanggang italaga ng admin. Sa pag-assign,
--  ang BUKAS na cycle ng metrong pinili ang gagamitin — doon lang natin
--  talagang malalaman kung saang buwan at kaninong bahay ito napupunta.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

alter table public.unassigned_readings
  alter column billing_cycle_id drop not null;

comment on column public.unassigned_readings.billing_cycle_id is
  'NULL hangga''t hindi naitatalaga — ang cycle ng napiling metro ang gagamitin.';

-- ---------------------------------------------------------------------
--  assign_unassigned_reading — hanapin ang cycle mula sa metro
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
  v_cycle  uuid;
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

  -- Ang cycle: kung may nakatakda na, iyon; kung wala, ang BUKAS na cycle
  -- ng property ng metrong ito.
  v_cycle := u.billing_cycle_id;
  if v_cycle is null then
    select c.id into v_cycle
    from public.billing_cycles c
    where c.property_id = v_meter.property_id
      and c.status in ('open', 'reading')
    order by c.code desc
    limit 1;

    if v_cycle is null then
      raise exception
        'Walang bukas na billing cycle ang property na ito. Magbukas muna bago italaga ang basa.';
    end if;
  end if;

  if exists (
    select 1 from public.meter_readings
    where meter_id = p_meter_id and billing_cycle_id = v_cycle
  ) then
    raise exception 'May reading na ang metrong ito sa cycle na ito.';
  end if;

  insert into public.meter_readings (
    meter_id, billing_cycle_id, previous_reading, present_reading,
    photo_path, remarks, read_by
  ) values (
    p_meter_id, v_cycle,
    -- NULL = ang huling basa ng metrong ito ang gagamitin (0018 trigger),
    -- hindi ang hula ng staff.
    null,
    u.present_reading,
    u.photo_path, u.remarks, u.read_by
  )
  returning id into v_new_id;

  update public.unassigned_readings
     set status              = 'assigned',
         billing_cycle_id    = v_cycle,
         assigned_meter_id   = p_meter_id,
         assigned_reading_id = v_new_id,
         resolved_by         = auth.uid(),
         resolved_at         = now()
   where id = p_id;

  return v_new_id;
end;
$$;

grant execute on function public.assign_unassigned_reading(uuid, uuid) to authenticated;
