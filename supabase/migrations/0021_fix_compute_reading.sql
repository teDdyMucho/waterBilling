-- =====================================================================
--  SCS BILLING PORTAL — Migration 0021
--  HOTFIX: "column p.is_unassigned does not exist"
--
--  Ano ang nangyari:
--  Ang unang bersyon ng 0019 (special properties — hindi na ginagamit)
--  ay nagpalit ng compute_reading() para tingnan ang properties.is_unassigned.
--  Ang kapalit na 0019 (unassigned_readings) ay bumurahin ng column na iyon
--  pero hindi naibalik ang function — kaya naiwan itong tumuturo sa column
--  na wala na.
--
--  Epekto: BAWAT insert sa meter_readings ay bumabagsak — ang pag-encode ng
--  staff at ang Assign ng admin. Ito ang 400 sa assign_unassigned_reading.
--
--  Ayos: ibalik ang compute_reading() sa bersyon ng 0018 — walang tinutukoy
--  na is_unassigned, at ginagalang ang previous_reading na ibinigay.
--
--  Ligtas ulit-ulitin (idempotent). Patakbuhin ito kahit hindi mo natandaang
--  na-run mo ang lumang 0019 — pareho lang ang resulta.
-- =====================================================================

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

-- ---------------------------------------------------------------------
--  Tsek: dapat walang lalabas na is_unassigned dito
-- ---------------------------------------------------------------------
select position('is_unassigned' in pg_get_functiondef(p.oid)) as should_be_zero
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'compute_reading';
