-- =====================================================================
--  SCS BILLING PORTAL — Migration 0022
--  AYUSIN: hindi kasama sa bill ang basang naidagdag PAGKATAPOS mag-generate
--
--  Ang nangyayari:
--    1) Na-encode ang tubig -> Generate bills -> may DRAFT na bill (tubig lang)
--    2) Naidagdag ang kuryente (bagong encode, o na-assign mula sa Unknown)
--    3) Generate ulit -> LINALAKTAWAN ang property dahil "may bill na"
--       => Ang kuryente ay HINDI KAILANMAN masisingil sa cycle na iyon,
--          at walang babala — tahimik lang itong nawawala.
--
--  Ayos: kapag DRAFT pa ang bill, buuin itong muli mula sa kasalukuyang
--  verified na basa. Ligtas ito dahil ang draft ay hindi pa nakikita ng
--  homeowner. Ang NAILABAS na bill (unpaid/paid/overdue) ay hindi ginagalaw
--  — hindi puwedeng baguhin ang bill na nasa kamay na ng tao.
--
--  Pinapanatili ang MISMONG bill (id at bill_no) ng draft — ina-update lang
--  ang halaga at pinapalitan ang line items. Kaya hindi lumalaktaw ang
--  numero at hindi nasisira ang anumang tumutukoy sa bill na iyon.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

create or replace function public.generate_bills(p_cycle_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_cycle     public.billing_cycles;
  v_date      date;
  v_prop      record;
  v_rd        record;
  v_water     numeric;
  v_electric  numeric;
  v_dues      numeric;
  v_prev      numeric;
  v_current   numeric;
  v_bill_id   uuid;
  v_seq       int;
  v_count     int := 0;
  -- Bago: ang kasalukuyang bill ng property sa cycle na ito
  v_old_id     uuid;
  v_old_status text;
  v_old_no     text;
  v_bill_no    text;
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makakapag-generate ng bill.' using errcode = '42501';
  end if;

  select * into v_cycle from public.billing_cycles where id = p_cycle_id;
  if v_cycle.id is null then raise exception 'Walang ganitong cycle.'; end if;
  v_date := coalesce(v_cycle.bill_date, current_date);

  select count(*) into v_seq from public.bills where billing_cycle_id = p_cycle_id;

  for v_prop in
    select distinct m.property_id
    from public.meters m
    join public.meter_readings mr
      on mr.meter_id = m.id and mr.billing_cycle_id = p_cycle_id and mr.status = 'verified'
    where m.status = 'active'
  loop
    select id, status, bill_no
      into v_old_id, v_old_status, v_old_no
      from public.bills
     where property_id = v_prop.property_id and billing_cycle_id = p_cycle_id;

    if v_old_id is not null then
      -- Nailabas na — huwag nang galawin.
      if v_old_status <> 'draft' then
        continue;
      end if;
      -- Draft pa — GAMITIN ang mismong bill na ito. Ang line items lang
      -- ang binubura at pinapalitan; hindi nagbabago ang id at bill_no.
      v_bill_id := v_old_id;
      v_bill_no := v_old_no;
      delete from public.bill_items where bill_id = v_old_id;
    else
      v_seq := v_seq + 1;
      v_bill_id := gen_random_uuid();
      v_bill_no := 'SCS-' || v_cycle.code || '-' || lpad(v_seq::text, 5, '0');
    end if;

    -- Kabuuang singil kada utility
    select coalesce(sum(public.compute_charge('water', mr.consumption, v_date)), 0)
      into v_water
    from public.meter_readings mr join public.meters m on m.id = mr.meter_id
    where m.property_id = v_prop.property_id and m.utility_type = 'water'
      and mr.billing_cycle_id = p_cycle_id and mr.status = 'verified';

    select coalesce(sum(public.compute_charge('electric', mr.consumption, v_date)), 0)
      into v_electric
    from public.meter_readings mr join public.meters m on m.id = mr.meter_id
    where m.property_id = v_prop.property_id and m.utility_type = 'electric'
      and mr.billing_cycle_id = p_cycle_id and mr.status = 'verified';

    v_dues := public.compute_charge('assoc_dues', 0, v_date);

    select coalesce(sum(balance), 0) into v_prev
    from public.bills
    where property_id = v_prop.property_id and status in ('unpaid','partially_paid','overdue');

    v_current := v_water + v_electric + v_dues;

    if v_old_id is not null then
      update public.bills
         set previous_balance = v_prev,
             water_amount     = v_water,
             electric_amount  = v_electric,
             assoc_dues       = v_dues,
             current_charges  = v_current,
             penalty_amount   = 0,
             total_amount     = v_prev + v_current,
             due_date         = v_cycle.due_date,
             generated_by     = auth.uid()
       where id = v_bill_id;
    else
      insert into public.bills (
        id, bill_no, property_id, billing_cycle_id, previous_balance,
        water_amount, electric_amount, assoc_dues, current_charges,
        penalty_amount, total_amount, due_date, status, generated_by
      ) values (
        v_bill_id, v_bill_no,
        v_prop.property_id, p_cycle_id, v_prev,
        v_water, v_electric, v_dues, v_current,
        0, v_prev + v_current, v_cycle.due_date, 'draft', auth.uid()
      );
    end if;

    -- Detalyadong line items kada reading
    for v_rd in
      select mr.id as reading_id, mr.consumption, m.utility_type
      from public.meter_readings mr join public.meters m on m.id = mr.meter_id
      where m.property_id = v_prop.property_id
        and mr.billing_cycle_id = p_cycle_id and mr.status = 'verified'
    loop
      insert into public.bill_items (bill_id, item_type, meter_reading_id, quantity, unit_price, amount, description)
      values (
        v_bill_id, v_rd.utility_type, v_rd.reading_id, v_rd.consumption,
        (public.active_rate(v_rd.utility_type, v_date)).rate_per_unit,
        public.compute_charge(v_rd.utility_type, v_rd.consumption, v_date),
        case when v_rd.utility_type = 'water' then 'Tubig' else 'Kuryente' end
      );
    end loop;

    if v_dues > 0 then
      insert into public.bill_items (bill_id, item_type, amount, description)
      values (v_bill_id, 'assoc_dues', v_dues, 'Association dues');
    end if;
    if v_prev > 0 then
      insert into public.bill_items (bill_id, item_type, amount, description)
      values (v_bill_id, 'previous_balance', v_prev, 'Naunang balanse');
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_bills(uuid) to authenticated;
