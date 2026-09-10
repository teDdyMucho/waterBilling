-- =====================================================================
--  SCS BILLING PORTAL — Migration 0030
--  BALIK SA PANG-BUONG-SUBDIVISION NA BILLING CYCLE
--
--  Desisyon ng may-ari: isang cycle kada buwan para sa LAHAT ng homeowner,
--  hindi isa kada bahay (binabaligtad ang 0026).
--
--  Ano ang ibig sabihin:
--    * Isang "2026-10" lang, at lahat ng property na may verified na basa
--      ay bibigyan ng bill mula rito.
--    * Isang New cycle kada buwan, isang Generate, isang Release —
--      hindi na 50 beses kung 50 ang bahay.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Alisin ang kabit sa property
--     Walang datos na mawawala na mahalaga — ang cycle ay panahon, at
--     ang bill ang nagsasabi kung kaninong property iyon.
-- ---------------------------------------------------------------------
drop index if exists public.cycles_one_open_per_property;
drop index if exists public.cycles_property_idx;

alter table public.billing_cycles drop column if exists property_id;

-- ---------------------------------------------------------------------
-- 2)  generate_bills — balik sa LAHAT ng property
--     Kapareho ng 0022 (rebuild ng draft, hindi ginagalaw ang nailabas),
--     inalis lang ang pagsala sa property ng cycle.
-- ---------------------------------------------------------------------
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
      -- Draft pa — gamitin ang mismong bill; line items lang ang papalitan.
      v_bill_id := v_old_id;
      v_bill_no := v_old_no;
      delete from public.bill_items where bill_id = v_old_id;
    else
      v_seq := v_seq + 1;
      v_bill_id := gen_random_uuid();
      v_bill_no := 'SCS-' || v_cycle.code || '-' || lpad(v_seq::text, 5, '0');
    end if;

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

-- ---------------------------------------------------------------------
-- 3)  Auto-next-cycle — balik sa pang-buong-subdivision (gaya ng 0025)
--     Ang code ay YYYY-MM na lang; wala nang kasamang lote.
-- ---------------------------------------------------------------------
create or replace function public.sync_cycle_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c      public.billing_cycles;
  v_next date;
  v_code text;
begin
  if new.billing_cycle_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.bills b
    where b.billing_cycle_id = new.billing_cycle_id
      and b.status not in ('paid', 'voided')
  ) then
    update public.billing_cycles
       set status = 'closed', updated_at = now()
     where id = new.billing_cycle_id and status = 'billed';

    select * into c from public.billing_cycles where id = new.billing_cycle_id;

    if c.id is not null and c.status = 'closed' then
      -- Isang bukas na cycle lang sa buong subdivision
      if not exists (
        select 1 from public.billing_cycles where status in ('open', 'reading')
      ) then
        v_next := coalesce(c.reading_start, c.bill_date, c.due_date);

        if v_next is not null then
          v_code := to_char(v_next + interval '1 month', 'YYYY-MM');

          if not exists (select 1 from public.billing_cycles where code = v_code) then
            insert into public.billing_cycles (
              code, reading_start, reading_end, bill_date, due_date, grace_days, status
            ) values (
              v_code,
              case when c.reading_start is null then null else (c.reading_start + interval '1 month')::date end,
              case when c.reading_end   is null then null else (c.reading_end   + interval '1 month')::date end,
              case when c.bill_date     is null then null else (c.bill_date     + interval '1 month')::date end,
              case when c.due_date      is null then null else (c.due_date      + interval '1 month')::date end,
              c.grace_days,
              'open'
            );

            insert into public.notifications (recipient_id, type, title, body, link)
            select p.id, 'cycle', 'Bukas na ang bagong billing cycle',
                   'Cycle ' || v_code || ' — puwede nang mag-encode ng basa.',
                   case when p.role = 'admin' then '/admin/cycles' else '/staff/readings' end
            from public.profiles p
            where p.role in ('admin', 'staff') and p.status = 'active';
          end if;
        end if;
      end if;
    end if;

  else
    update public.billing_cycles
       set status = 'billed', updated_at = now()
     where id = new.billing_cycle_id and status = 'closed';
  end if;

  return new;
end $$;

drop trigger if exists trg_sync_cycle_closed on public.bills;
create trigger trg_sync_cycle_closed
  after update of status on public.bills
  for each row
  execute function public.sync_cycle_closed();

-- ---------------------------------------------------------------------
--  I-verify
-- ---------------------------------------------------------------------
select code, status, reading_start, reading_end, due_date
from public.billing_cycles
order by code desc;
