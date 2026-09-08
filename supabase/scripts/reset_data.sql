-- =====================================================================
--  SCS BILLING PORTAL — FULL DATA RESET
--
--  Nililinis ang BUONG datos ng database. Ang natitira lang:
--    * admin@scs.test      (Admin12345)
--    * staff@scs.test      (Staff12345)
--    * homeowner@scs.test  (Home12345)
--
--  BABALA: HINDI NA MABABAWI ANG NABURA. Mag-backup muna kung kailangan.
--
--  PAANO: Supabase Dashboard -> SQL Editor -> New query -> paste lahat -> Run.
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0a) SAFETY GUARD — huwag ituloy kung kulang ang tatlong account.
--     (Kung wala sila, ibig sabihin mali ang database o naibang emails —
--      titigil ang script at walang mabubura.)
-- ---------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n
    from auth.users
   where email in ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test');
  if n <> 3 then
    raise exception
      'ABORT: % sa 3 test accounts ang nakita. Walang binura. Tingnan muna ang auth.users.', n;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 0b) I-off ang profile-protect trigger (walang auth.uid() sa SQL editor,
--     kaya "hindi admin" ang tingin nito).
-- ---------------------------------------------------------------------
alter table public.profiles disable trigger trg_protect_profile;

-- ---------------------------------------------------------------------
-- 1)  Pera / audit
-- ---------------------------------------------------------------------
delete from public.audit_logs;
delete from public.payment_allocations;
delete from public.payments;

-- ---------------------------------------------------------------------
-- 2)  Bills at billing cycles
-- ---------------------------------------------------------------------
delete from public.bill_items;
delete from public.bills;
delete from public.meter_readings;
delete from public.billing_cycles;

-- ---------------------------------------------------------------------
-- 3)  Rates  (KONPIGURASYON — i-comment out kung gusto mong itira)
-- ---------------------------------------------------------------------
delete from public.rates;

-- ---------------------------------------------------------------------
-- 4)  Properties, meters, at ownership links
-- ---------------------------------------------------------------------
delete from public.property_owners;
delete from public.meters;
delete from public.properties;

-- ---------------------------------------------------------------------
-- 5)  Concerns / messages / notifications / announcements
-- ---------------------------------------------------------------------
delete from public.messages;
delete from public.message_threads;
delete from public.notifications;
delete from public.announcements;
delete from public.push_subscriptions;

-- ---------------------------------------------------------------------
-- 6)  Payment settings — babalik sa blanko, iiwan ang row (id = 1).
--     I-comment out ang UPDATE kung gusto mong itira ang GCash/Maya/bank
--     details na naka-set na.
-- ---------------------------------------------------------------------
insert into public.payment_settings (id) values (1) on conflict (id) do nothing;
update public.payment_settings
   set gcash_number      = null,
       gcash_name        = null,
       maya_number       = null,
       maya_name         = null,
       bank_name         = null,
       bank_account      = null,
       bank_account_name = null,
       qr_path           = '/qr-sample.png',   -- sample QR na kasama sa app
       instructions      = null,
       updated_at        = now()
 where id = 1;

-- ---------------------------------------------------------------------
-- 7)  Users — burahin LAHAT maliban sa tatlong test account.
--     Nag-cascade ito sa public.profiles at auth.identities.
-- ---------------------------------------------------------------------
delete from auth.users
 where coalesce(email, '') not in
       ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test');

-- Ibalik ang tatlo sa malinis na estado (active para makapag-login agad).
-- Naka-match sa auth.users.id — hindi umaasa na punan ang profiles.email.
update public.profiles p
   set email            = u.email,
       full_name        = case u.email
                            when 'admin@scs.test' then 'SCS Admin'
                            when 'staff@scs.test' then 'SCS Staff'
                            else 'Juan Dela Cruz'
                          end,
       role             = case u.email
                            when 'admin@scs.test' then 'admin'
                            when 'staff@scs.test' then 'staff'
                            else 'homeowner'
                          end,
       status           = 'active',
       contact_number   = null,
       block            = case u.email when 'homeowner@scs.test' then '5'  else null end,
       lot              = case u.email when 'homeowner@scs.test' then '12' else null end,
       rejection_reason = null,
       approved_by      = null,
       approved_at      = now(),
       updated_at       = now()
  from auth.users u
 where u.id = p.id
   and u.email in ('admin@scs.test', 'staff@scs.test', 'homeowner@scs.test');

-- ---------------------------------------------------------------------
-- 8)  Storage — HINDI dito nililinis.
--     Bina-block na ng Supabase ang direktang DELETE sa storage.objects:
--       "ERROR 42501: Direct deletion from storage tables is not allowed.
--        Use the Storage API instead."
--     Kaya manu-mano ito sa Dashboard -> Storage (tingnan ang NOTE sa dulo).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 9)  I-reset ang mga numbering sequence (payment no., OR no., ticket no.)
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
select email, role, status, block, lot from public.profiles order by role;

select 'properties' as tbl, count(*) from public.properties
union all select 'meters',              count(*) from public.meters
union all select 'billing_cycles',      count(*) from public.billing_cycles
union all select 'meter_readings',      count(*) from public.meter_readings
union all select 'bills',               count(*) from public.bills
union all select 'bill_items',          count(*) from public.bill_items
union all select 'payments',            count(*) from public.payments
union all select 'payment_allocations', count(*) from public.payment_allocations
union all select 'rates',               count(*) from public.rates
union all select 'message_threads',     count(*) from public.message_threads
union all select 'messages',            count(*) from public.messages
union all select 'notifications',       count(*) from public.notifications
union all select 'announcements',       count(*) from public.announcements
union all select 'audit_logs',          count(*) from public.audit_logs
union all select 'push_subscriptions',  count(*) from public.push_subscriptions
union all select 'auth.users',          count(*) from auth.users;

-- =====================================================================
--  NOTE — STORAGE FILES (manu-manong hakbang)
--  Hindi puwedeng burahin sa SQL ang storage.objects (Storage API lang ang
--  pinapayagan ng Supabase). Kaya pagkatapos mag-Run nito:
--
--    Dashboard -> Storage -> bawat bucket -> select all -> Delete
--
--  Mga bucket na dapat walisin:
--    meter-photos, message-attachments, payment-proofs, avatars, public-assets
--
--  Walang masisira kung hindi mo ito gagawin — mga orphan na file lang sila
--  na wala nang tumuturo sa kanila mula sa database.
-- =====================================================================
