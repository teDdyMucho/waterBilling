-- =====================================================================
--  SCS BILLING PORTAL — Migration 0005
--  Fix: hayaan ang STAFF na MAKITA ang pangalan/contact ng homeowner
--       (read-only) para sa billing context — pero HINDI pa rin kayang
--       i-edit ang account (walang update/delete policy ang staff).
--
--  I-run PAGKATAPOS ng 0001 at 0004. Ligtas ulit-ulitin.
--
--  Bakit kailangan:
--   - Ang property list/detail ay kumukuha ng owner name mula sa profiles.
--   - Dati, sariling row lang ang nakikita ng staff → "No owner linked".
--   - Kailangan ng staff na makita kung sino ang may-ari ng bawat lote
--     para makatulong sa billing at meter reading (Phase 3).
--
--  Panatili ang seguridad:
--   - SELECT lang ito (read). WALANG update/delete policy ang staff sa
--     profiles → hindi nila kayang "hawakan" ang account.
--   - Homeowner rows lang ang makikita ng staff — HINDI ang ibang staff
--     o admin profiles.
-- =====================================================================

drop policy if exists profiles_select_staff_homeowners on public.profiles;

create policy profiles_select_staff_homeowners
  on public.profiles for select
  to authenticated
  using (
    role = 'homeowner'
    and public.get_my_role() = 'staff'
  );

-- =====================================================================
--  TAPOS. Mag-refresh ang staff view — lalabas na ang naka-link na
--  homeowner sa bawat lote.
-- =====================================================================
