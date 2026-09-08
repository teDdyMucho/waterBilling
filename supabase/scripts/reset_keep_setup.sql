-- =====================================================================
--  SCS BILLING PORTAL — RESET, PERO ITIRA ANG SETUP
--
--  BUBURAHIN: lahat ng transaksyon — readings, bills, payments, concerns,
--  notifications, announcements, audit logs, at ang mga property na WALA
--  sa homeowner.
--
--  ITITIRA:
--    * rates                      (buo)
--    * billing_cycles             (buo)
--    * ang property ng homeowner@scs.test — pati metro at owner link
--    * payment_settings           (konpigurasyon)
--    * admin@scs.test / staff@scs.test / homeowner@scs.test
--
--  BABALA: HINDI NA MABABAWI ANG NABURA.
--  PAANO: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0)  SAFETY GUARD
--     Titigil kung kulang ang tatlong account, O kung walang property
--     ang homeowner — dahil kung wala, MALILINIS ang lahat ng property.
-- ---------------------------------------------------------------------
do $$
declare
  n_users int;
  n_props int;
begin
  select count(*) into n_users
    from auth.users
   where email in ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test');
  if n_users <> 3 then
    raise exception 'ABORT: % sa 3 test accounts ang nakita. Walang binura.', n_users;
  end if;

  select count(*) into n_props
    from public.property_owners po
    join public.profiles p on p.id = po.profile_id
   where p.email = 'homeowner@scs.test';
  if n_props = 0 then
    raise exception
      'ABORT: walang property na naka-link kay homeowner@scs.test. Walang binura — kung tuloy ito, mabubura LAHAT ng property.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1)  I-off ang profile-protect trigger (walang auth.uid() sa SQL editor)
-- ---------------------------------------------------------------------
alter table public.profiles disable trigger trg_protect_profile;

-- ---------------------------------------------------------------------
-- 2)  Pera
-- ---------------------------------------------------------------------
delete from public.payment_allocations;
delete from public.payments;

-- ---------------------------------------------------------------------
-- 3)  Bills
-- ---------------------------------------------------------------------
delete from public.bill_items;
delete from public.bills;

-- ---------------------------------------------------------------------
-- 4)  Readings — ang unassigned_readings muna (may FK sa readings/meters)
-- ---------------------------------------------------------------------
delete from public.unassigned_readings;
delete from public.meter_readings;

-- ---------------------------------------------------------------------
-- 5)  Concerns / messages / notifications / announcements / audit
-- ---------------------------------------------------------------------
delete from public.messages;
delete from public.message_threads;
delete from public.notifications;
delete from public.announcements;
delete from public.push_subscriptions;
delete from public.audit_logs;

-- ---------------------------------------------------------------------
-- 6)  Mga property na HINDI sa homeowner (pati metro at owner link nila)
--
--     Una: itira LANG ang owner link ng homeowner. Pagkatapos nito, ang
--     natitirang property_owners ang mismong listahan ng ititirang
--     property — kaya iyon na ang gagamitin sa susunod na dalawa.
--     (Walang temp table — hindi ito nakikita ng SQL Editor sa susunod
--      na statement.)
-- ---------------------------------------------------------------------
delete from public.property_owners po
 where not exists (
   select 1 from public.profiles p
   where p.id = po.profile_id and p.email = 'homeowner@scs.test'
 );

-- Ang replaced_meter_id ay tumuturo sa ibang metro — kalagin muna
-- para hindi humarang sa pagbura.
update public.meters m
   set replaced_meter_id = null
 where not exists (
   select 1 from public.property_owners po where po.property_id = m.property_id
 );

delete from public.meters m
 where not exists (
   select 1 from public.property_owners po where po.property_id = m.property_id
 );

delete from public.properties p
 where not exists (
   select 1 from public.property_owners po where po.property_id = p.id
 );

-- ---------------------------------------------------------------------
-- 7)  Users — burahin LAHAT maliban sa tatlo (cascade sa profiles)
-- ---------------------------------------------------------------------
delete from auth.users
 where coalesce(email, '') not in
       ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test');

update public.profiles p
   set status     = 'active',
       role       = case u.email
                      when 'admin@scs.test' then 'admin'
                      when 'staff@scs.test' then 'staff'
                      else 'homeowner'
                    end,
       updated_at = now()
  from auth.users u
 where u.id = p.id
   and u.email in ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test');

-- ---------------------------------------------------------------------
-- 8)  Numbering — walang natirang bill o payment, kaya balik sa 1
-- ---------------------------------------------------------------------
alter sequence if exists public.ticket_seq  restart with 1;
alter sequence if exists public.payment_seq restart with 1;
alter sequence if exists public.receipt_seq restart with 1;

-- ---------------------------------------------------------------------
-- 9)  Ibalik ang trigger
-- ---------------------------------------------------------------------
alter table public.profiles enable trigger trg_protect_profile;

commit;

-- ---------------------------------------------------------------------
--  I-verify — dapat may laman pa ang rates, billing_cycles, at ang
--  property/meters ng homeowner; zero ang lahat ng iba.
-- ---------------------------------------------------------------------
select 'rates (itinira)'          as tbl, count(*) from public.rates
union all select 'billing_cycles (itinira)', count(*) from public.billing_cycles
union all select 'properties (itinira)',     count(*) from public.properties
union all select 'meters (itinira)',         count(*) from public.meters
union all select 'property_owners (itinira)',count(*) from public.property_owners
union all select 'auth.users (itinira)',     count(*) from auth.users
union all select '--- dapat 0 ---',          0
union all select 'meter_readings',           count(*) from public.meter_readings
union all select 'unassigned_readings',      count(*) from public.unassigned_readings
union all select 'bills',                    count(*) from public.bills
union all select 'bill_items',               count(*) from public.bill_items
union all select 'payments',                 count(*) from public.payments
union all select 'payment_allocations',      count(*) from public.payment_allocations
union all select 'message_threads',          count(*) from public.message_threads
union all select 'messages',                 count(*) from public.messages
union all select 'notifications',            count(*) from public.notifications
union all select 'announcements',            count(*) from public.announcements
union all select 'audit_logs',               count(*) from public.audit_logs
union all select 'push_subscriptions',       count(*) from public.push_subscriptions;

select p.block, p.lot, m.utility_type, m.meter_number
from public.properties p
left join public.meters m on m.property_id = p.id
order by p.block, p.lot;

-- =====================================================================
--  NOTE — STORAGE FILES (manu-mano)
--  Hindi puwedeng burahin sa SQL ang storage.objects (Storage API lang).
--  Dashboard -> Storage -> meter-photos, payment-proofs,
--  message-attachments, avatars -> select all -> Delete.
--  Orphan files lang sila; walang masisira kung iiwan mo.
-- =====================================================================
