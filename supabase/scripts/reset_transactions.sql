-- =====================================================================
--  SCS BILLING PORTAL — RESET NG TRANSAKSYON (setup nananatili)
--
--  ITITIRA:
--    * rates              — buo
--    * properties + meters + owner links — buo
--    * payment_settings   — buo
--    * admin@scs.test / staff@scs.test / homeowner@scs.test
--
--  BUBURAHIN:
--    * billing_cycles     — para makagawa ka ng bagong cycle na malinis
--    * meter_readings, unassigned_readings
--    * bills, bill_items
--    * payments, payment_allocations
--    * concerns/messages, notifications, announcements
--    * audit_logs, push_subscriptions
--    * lahat ng ibang user (at ang owner link nila)
--
--  BABALA: HINDI NA MABABAWI ANG NABURA.
--  PAANO: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0)  SAFETY GUARD — dapat kompleto ang tatlong account
-- ---------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n
    from auth.users
   where email in ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test');
  if n <> 3 then
    raise exception 'ABORT: % sa 3 test accounts ang nakita. Walang binura.', n;
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
-- 4)  Readings — inbox muna (may FK sa readings at meters)
-- ---------------------------------------------------------------------
delete from public.unassigned_readings;
delete from public.meter_readings;

-- ---------------------------------------------------------------------
-- 5)  Billing cycles — dito ka gagawa ng bago
-- ---------------------------------------------------------------------
delete from public.billing_cycles;

-- ---------------------------------------------------------------------
-- 6)  Concerns / messages / notifications / announcements / audit
-- ---------------------------------------------------------------------
delete from public.messages;
delete from public.message_threads;
delete from public.notifications;
delete from public.announcements;
delete from public.push_subscriptions;
delete from public.audit_logs;

-- ---------------------------------------------------------------------
-- 7)  Owner links ng mga user na buburahin
--     Kailangang mauna ito: ang property_owners.profile_id ay WALANG
--     cascade, kaya haharangin nito ang pagbura ng user.
--     Ang property at metro mismo ay HINDI ginagalaw.
-- ---------------------------------------------------------------------
delete from public.property_owners po
 where not exists (
   select 1 from public.profiles p
   where p.id = po.profile_id
     and p.email in ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test')
 );

-- ---------------------------------------------------------------------
-- 8)  Users — burahin LAHAT maliban sa tatlo (cascade sa profiles)
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
-- 9)  Numbering — walang natirang bill o payment, kaya balik sa 1
-- ---------------------------------------------------------------------
alter sequence if exists public.ticket_seq  restart with 1;
alter sequence if exists public.payment_seq restart with 1;
alter sequence if exists public.receipt_seq restart with 1;

-- ---------------------------------------------------------------------
-- 10) Ibalik ang trigger
-- ---------------------------------------------------------------------
alter table public.profiles enable trigger trg_protect_profile;

commit;

-- ---------------------------------------------------------------------
--  I-verify
-- ---------------------------------------------------------------------
select 'rates (itinira)'            as tbl, count(*) from public.rates
union all select 'properties (itinira)',      count(*) from public.properties
union all select 'meters (itinira)',          count(*) from public.meters
union all select 'property_owners (itinira)', count(*) from public.property_owners
union all select 'payment_settings (itinira)',count(*) from public.payment_settings
union all select 'auth.users (itinira)',      count(*) from auth.users
union all select '--- dapat 0 ---',           0
union all select 'billing_cycles',            count(*) from public.billing_cycles
union all select 'meter_readings',            count(*) from public.meter_readings
union all select 'unassigned_readings',       count(*) from public.unassigned_readings
union all select 'bills',                     count(*) from public.bills
union all select 'bill_items',                count(*) from public.bill_items
union all select 'payments',                  count(*) from public.payments
union all select 'payment_allocations',       count(*) from public.payment_allocations
union all select 'message_threads',           count(*) from public.message_threads
union all select 'messages',                  count(*) from public.messages
union all select 'notifications',             count(*) from public.notifications
union all select 'announcements',             count(*) from public.announcements
union all select 'audit_logs',                count(*) from public.audit_logs
union all select 'push_subscriptions',        count(*) from public.push_subscriptions;

-- Ang natirang property at metro, at kung sino ang may-ari
select p.block, p.lot, m.utility_type, m.meter_number, pr.full_name as owner
from public.properties p
left join public.meters m on m.property_id = p.id
left join public.property_owners po on po.property_id = p.id and po.end_date is null
left join public.profiles pr on pr.id = po.profile_id
order by p.block, p.lot, m.utility_type;

-- =====================================================================
--  NOTE — STORAGE FILES (manu-mano)
--  Hindi puwedeng burahin sa SQL ang storage.objects (Storage API lang).
--  Dashboard -> Storage -> meter-photos, payment-proofs,
--  message-attachments, avatars -> select all -> Delete.
--  Orphan files lang sila; walang masisira kung iiwan mo.
-- =====================================================================
