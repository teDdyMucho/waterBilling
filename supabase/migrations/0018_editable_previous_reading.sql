-- =====================================================================
--  SCS BILLING PORTAL — Migration 0018
--  NA-E-EDIT NA ANG "Previous reading" SA PAG-ENCODE
--
--  Dati: sapilitang pinapalitan ng trigger ang previous_reading ng huling
--  nabasa sa metro (server-authoritative) — kaya walang epekto kahit ano
--  pa ang ipadala ng browser.
--
--  Ngayon: kung may ibinigay na previous_reading ang encoder, IYON ang
--  gagamitin. Kapag NULL (walang ibinigay), babalik sa dating gawi —
--  ang huling nabasa, o ang initial_reading ng metro.
--
--  ⚠️  TANDAAN: ang previous_reading ang basehan ng consumption
--  (generated column: present − previous) kaya direkta itong sumisingil.
--  Naka-log sa audit ang lahat ng reading, at kailangan pa ring i-verify
--  ng admin ang anomalya.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Alisin ang default na 0 — para makilala ang "walang ibinigay"
--     (NULL) mula sa "sadyang zero" na ibinigay ng encoder.
--     Hindi ito nagpapabago ng existing rows; NOT NULL pa rin ang column
--     dahil pinupunan ito ng trigger bago mag-insert.
-- ---------------------------------------------------------------------
alter table public.meter_readings
  alter column previous_reading drop default;

-- ---------------------------------------------------------------------
-- 2)  Trigger: gamitin ang ibinigay na previous, kung meron
--     (kapareho ng 0007 maliban sa isang linya sa INSERT branch)
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
    -- Kung may ibinigay ang encoder, iyon ang masusunod; kung wala,
    -- ang huling nabasa (o initial_reading) pa rin ang gagamitin.
    v_prev := coalesce(NEW.previous_reading, public.get_previous_reading(NEW.meter_id));
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
