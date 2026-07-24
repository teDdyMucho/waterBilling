-- =====================================================================
--  SCS BILLING PORTAL — Migration 0002 (BOOTSTRAP ADMIN)
--
--  GAMITIN ITO PAGKATAPOS:
--   1) I-run muna ang 0001_auth_profiles.sql
--   2) Mag-REGISTER sa app gamit ang email mo (magiging homeowner/pending)
--   3) Palitan ang email sa ibaba, tapos i-RUN ito para gawing ADMIN.
--
--  ⚠️ PALITAN ang 'ILAGAY-DITO-ANG-EMAIL-MO@gmail.com' ng totoong email mo.
-- =====================================================================

update public.profiles
set
  role   = 'admin',
  status = 'active'
where email = 'ILAGAY-DITO-ANG-EMAIL-MO@gmail.com';

-- Tingnan kung tumama:
select id, email, role, status
from public.profiles
where email = 'ILAGAY-DITO-ANG-EMAIL-MO@gmail.com';

-- =====================================================================
--  Para gumawa ng STAFF account (opsyonal):
--   1) Magparehistro ang staff sa app (homeowner/pending muna)
--   2) I-run ito ng admin (palitan ang email):
--
--     update public.profiles
--     set role = 'staff', status = 'active'
--     where email = 'staff-email@gmail.com';
-- =====================================================================
