-- =====================================================================
--  SCS BILLING PORTAL — Migration 0016
--  Payagan ang STAFF na makita ang pangalan ng kapwa STAFF/ADMIN
--
--  Bakit: sa Meter Readings worklist, ipinapakita kung sinong staff ang
--  nag-encode ng reading (read_by → profiles.full_name). Dati, ang staff ay
--  nakakabasa lang ng sarili + homeowners, kaya ang encoding ng IBANG staff
--  ay walang pangalang lumalabas. Dito, mababasa ng staff ang mga row ng
--  staff/admin (para sa encoder name at team context).
--
--  I-run PAGKATAPOS ng 0001 + 0005. Ligtas ulit-ulitin.
-- =====================================================================

drop policy if exists profiles_select_staff_team on public.profiles;

create policy profiles_select_staff_team
  on public.profiles for select
  to authenticated
  using (
    role in ('staff', 'admin')
    and public.get_my_role() = 'staff'
  );
