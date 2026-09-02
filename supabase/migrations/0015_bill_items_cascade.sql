-- =====================================================================
--  SCS BILLING PORTAL — Migration 0015
--  AYUSIN: 409 Conflict kapag nagbubura ng billing cycle
--
--  Ang bill_items.meter_reading_id ay WALANG "on delete cascade", kaya
--  kapag binura ang cycle (na nag-ca-cascade sa readings + bills), na-bo-block
--  ito ng bill_items na tumutukoy pa sa reading → 409.
--
--  Dagdagan ng ON DELETE CASCADE: kapag nabura ang reading, mabubura rin ang
--  line item nito. Ligtas ulit-ulitin.
-- =====================================================================

alter table public.bill_items
  drop constraint if exists bill_items_meter_reading_id_fkey;

alter table public.bill_items
  add constraint bill_items_meter_reading_id_fkey
  foreign key (meter_reading_id) references public.meter_readings (id) on delete cascade;
