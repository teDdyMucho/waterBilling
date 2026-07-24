-- =====================================================================
--  SCS BILLING PORTAL — Migration 0008
--  Phase 4: Billing Engine — Rates (effective-dated), Bills, Bill Items,
--           generate/release RPCs, penalty engine
--
--  I-run PAGKATAPOS ng 0001, 0004, 0007. Ligtas ulit-ulitin.
--
--  PERA: numeric(12,2) na piso sa DB (EXACT ang Postgres numeric —
--        walang floating-point error). Ang generation ay nasa DB para
--        atomic at tama.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  rates — effective-dated (may history)
--     kind: water | electric | assoc_dues | penalty
-- ---------------------------------------------------------------------
create table if not exists public.rates (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('water', 'electric', 'assoc_dues', 'penalty')),
  rate_type       text not null default 'flat' check (rate_type in ('flat', 'tiered', 'fixed')),
  rate_per_unit   numeric(12, 4) not null default 0,   -- kada m³ / kWh
  minimum_charge  numeric(12, 2) not null default 0,
  fixed_amount    numeric(12, 2) not null default 0,   -- para sa assoc_dues
  tiers           jsonb,
  penalty_percent numeric(5, 2)  not null default 0,   -- para sa 'penalty'
  penalty_fixed   numeric(12, 2) not null default 0,
  effective_from  date not null default current_date,
  effective_to    date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists rates_kind_idx on public.rates (kind, effective_from);

-- ---------------------------------------------------------------------
-- 2)  bills
-- ---------------------------------------------------------------------
create table if not exists public.bills (
  id               uuid primary key default gen_random_uuid(),
  bill_no          text not null unique,
  property_id      uuid not null references public.properties (id) on delete cascade,
  billing_cycle_id uuid not null references public.billing_cycles (id) on delete cascade,
  previous_balance numeric(12, 2) not null default 0,
  water_amount     numeric(12, 2) not null default 0,
  electric_amount  numeric(12, 2) not null default 0,
  assoc_dues       numeric(12, 2) not null default 0,
  current_charges  numeric(12, 2) not null default 0,
  penalty_amount   numeric(12, 2) not null default 0,
  total_amount     numeric(12, 2) not null default 0,
  amount_paid      numeric(12, 2) not null default 0,
  balance          numeric(12, 2) generated always as (total_amount - amount_paid) stored,
  due_date         date,
  status           text not null default 'draft'
                     check (status in ('draft','unpaid','payment_pending','partially_paid','paid','overdue','voided')),
  released_at      timestamptz,
  generated_by     uuid references auth.users (id),
  void_reason      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (property_id, billing_cycle_id)   -- walang doble
);
create index if not exists bills_property_idx on public.bills (property_id);
create index if not exists bills_cycle_idx on public.bills (billing_cycle_id);
create index if not exists bills_status_idx on public.bills (status);

drop trigger if exists trg_bills_updated_at on public.bills;
create trigger trg_bills_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3)  bill_items — line items
-- ---------------------------------------------------------------------
create table if not exists public.bill_items (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid not null references public.bills (id) on delete cascade,
  item_type       text not null check (item_type in ('water','electric','assoc_dues','penalty','adjustment','previous_balance')),
  meter_reading_id uuid references public.meter_readings (id),
  rate_id         uuid references public.rates (id),
  quantity        numeric(12, 2),
  unit_price      numeric(12, 4),
  amount          numeric(12, 2) not null default 0,
  description     text
);
create index if not exists bill_items_bill_idx on public.bill_items (bill_id);

-- ---------------------------------------------------------------------
-- 4)  Helper: aktibong rate sa isang petsa
-- ---------------------------------------------------------------------
create or replace function public.active_rate(p_kind text, p_date date)
returns public.rates
language sql stable security definer set search_path = public
as $$
  select * from public.rates
  where kind = p_kind and is_active
    and effective_from <= p_date
    and (effective_to is null or effective_to >= p_date)
  order by effective_from desc
  limit 1;
$$;
grant execute on function public.active_rate(text, date) to authenticated;

-- ---------------------------------------------------------------------
-- 5)  Helper: singil para sa konsumo (flat + minimum; fixed para dues)
-- ---------------------------------------------------------------------
create or replace function public.compute_charge(p_kind text, p_consumption numeric, p_date date)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  r   public.rates;
  amt numeric := 0;
begin
  r := public.active_rate(p_kind, p_date);
  if r.id is null then return 0; end if;

  if p_kind = 'assoc_dues' then
    return round(coalesce(r.fixed_amount, 0), 2);
  end if;

  amt := coalesce(p_consumption, 0) * coalesce(r.rate_per_unit, 0);
  if amt < coalesce(r.minimum_charge, 0) then
    amt := r.minimum_charge;
  end if;
  return round(amt, 2);
end;
$$;
grant execute on function public.compute_charge(text, numeric, date) to authenticated;

-- ---------------------------------------------------------------------
-- 6)  RPC: generate_bills(cycle) — DRAFT bills mula sa verified readings
--     Idempotent (skip kung may bill na). Admin lang.
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
    if exists (
      select 1 from public.bills
      where property_id = v_prop.property_id and billing_cycle_id = p_cycle_id
    ) then
      continue;
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
    v_seq := v_seq + 1;
    v_bill_id := gen_random_uuid();

    insert into public.bills (
      id, bill_no, property_id, billing_cycle_id, previous_balance,
      water_amount, electric_amount, assoc_dues, current_charges,
      penalty_amount, total_amount, due_date, status, generated_by
    ) values (
      v_bill_id, 'SCS-' || v_cycle.code || '-' || lpad(v_seq::text, 5, '0'),
      v_prop.property_id, p_cycle_id, v_prev,
      v_water, v_electric, v_dues, v_current,
      0, v_prev + v_current, v_cycle.due_date, 'draft', auth.uid()
    );

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

-- ---------------------------------------------------------------------
-- 7)  RPC: release_cycle_bills — draft → unpaid, cycle → billed
-- ---------------------------------------------------------------------
create or replace function public.release_cycle_bills(p_cycle_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_count int;
begin
  if not public.is_admin() then
    raise exception 'Admin lang.' using errcode = '42501';
  end if;
  update public.bills set status = 'unpaid', released_at = now()
  where billing_cycle_id = p_cycle_id and status = 'draft';
  get diagnostics v_count = row_count;
  update public.billing_cycles set status = 'billed' where id = p_cycle_id;
  return v_count;
end;
$$;
grant execute on function public.release_cycle_bills(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8)  RPC: apply_penalties — markahan overdue + magdagdag ng penalty
--     (isang beses lang kada bill). Para sa pg_cron o manual na admin.
-- ---------------------------------------------------------------------
create or replace function public.apply_penalties()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  b       record;
  g       int;
  pr      public.rates;
  pen     numeric;
  v_count int := 0;
begin
  for b in
    select * from public.bills
    where status in ('unpaid', 'partially_paid') and due_date is not null
  loop
    select grace_days into g from public.billing_cycles where id = b.billing_cycle_id;
    if current_date > (b.due_date + coalesce(g, 5)) then
      if b.penalty_amount = 0 then
        pr := public.active_rate('penalty', current_date);
        pen := round(
          b.total_amount * coalesce(pr.penalty_percent, 0) / 100.0
          + coalesce(pr.penalty_fixed, 0), 2);
        if pen > 0 then
          update public.bills
            set penalty_amount = pen,
                total_amount = total_amount + pen,
                status = 'overdue'
          where id = b.id;
          insert into public.bill_items (bill_id, item_type, amount, description)
          values (b.id, 'penalty', pen, 'Penalty (overdue)');
        else
          update public.bills set status = 'overdue' where id = b.id;
        end if;
        v_count := v_count + 1;
      elsif b.status <> 'overdue' then
        update public.bills set status = 'overdue' where id = b.id;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;
grant execute on function public.apply_penalties() to authenticated;

-- Optional: i-schedule sa pg_cron (kung enabled). Manual din via admin button.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('scs-apply-penalties');
    exception when others then null;
    end;
    perform cron.schedule('scs-apply-penalties', '30 0 * * *', 'select public.apply_penalties()');
  end if;
exception when others then null;
end $$;

-- =====================================================================
-- 9)  RLS
-- =====================================================================
alter table public.rates      enable row level security;
alter table public.bills      enable row level security;
alter table public.bill_items enable row level security;

-- rates: lahat makakabasa (transparency); admin lang mag-edit
drop policy if exists rates_select on public.rates;
drop policy if exists rates_write_admin on public.rates;
create policy rates_select on public.rates for select to authenticated using (true);
create policy rates_write_admin on public.rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- bills: staff/admin = lahat; homeowner = sarili at HINDI draft
drop policy if exists bills_select on public.bills;
drop policy if exists bills_write_admin on public.bills;
create policy bills_select on public.bills for select to authenticated
  using (
    public.is_staff_or_admin()
    or (public.owns_property(property_id) and status <> 'draft')
  );
create policy bills_write_admin on public.bills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- bill_items: sundin ang visibility ng parent bill
drop policy if exists bill_items_select on public.bill_items;
drop policy if exists bill_items_write_admin on public.bill_items;
create policy bill_items_select on public.bill_items for select to authenticated
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
        and (
          public.is_staff_or_admin()
          or (public.owns_property(b.property_id) and b.status <> 'draft')
        )
    )
  );
create policy bill_items_write_admin on public.bill_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
--  TAPOS ang 0008. Susunod: Admin → Rates (magtakda), tapos Cycles →
--  Generate Bills → Release.
-- =====================================================================
