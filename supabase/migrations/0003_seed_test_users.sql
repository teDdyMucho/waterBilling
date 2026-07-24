-- =====================================================================
--  SCS BILLING PORTAL — Migration 0003 (SEED TEST ACCOUNTS)
--  Gumagawa ng 3 ready-to-use na account para makapag-test agad.
--
--  I-run PAGKATAPOS ng 0001. Ligtas ulit-ulitin (idempotent).
--
--  MGA CREDENTIALS na gagawa nito:
--    ┌───────────┬─────────────────────┬─────────────┬──────────┐
--    │ Role      │ Email               │ Password    │ Status   │
--    ├───────────┼─────────────────────┼─────────────┼──────────┤
--    │ Admin     │ admin@scs.test      │ Admin12345  │ active   │
--    │ Staff     │ staff@scs.test      │ Staff12345  │ active   │
--    │ Homeowner │ homeowner@scs.test  │ Home12345   │ pending  │  ← naka-pending (para ma-test ang approval)
--    └───────────┴─────────────────────┴─────────────┴──────────┘
-- =====================================================================

-- ---------------------------------------------------------------------
--  Helper: gumawa ng auth user + identity, tapos i-set ang role/status.
-- ---------------------------------------------------------------------
create or replace function public.create_seed_user(
  p_email      text,
  p_password   text,
  p_full_name  text,
  p_role       text,
  p_status     text,
  p_block      text default null,
  p_lot        text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = p_email;

  if uid is null then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid, 'authenticated', 'authenticated', p_email,
      crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', p_full_name, 'contact_number', '',
        'block', p_block, 'lot', p_lot, 'preferred_language', 'tl'
      ),
      '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid::text, uid,
      jsonb_build_object(
        'sub', uid::text, 'email', p_email,
        'email_verified', true, 'phone_verified', false
      ),
      'email', now(), now(), now()
    );
  end if;

  -- I-set/i-ayos ang profile sa target na role/status
  -- (ginawa na ito ng handle_new_user trigger bilang homeowner/pending;
  --  dito ito itatama).
  update public.profiles
     set role        = p_role,
         status      = p_status,
         full_name   = p_full_name,
         block       = p_block,
         lot         = p_lot,
         approved_at = case when p_status = 'active' then now() else null end
   where id = uid;

  return uid;
end;
$$;

-- ---------------------------------------------------------------------
--  I-off muna ang protect trigger — sa SQL editor ay walang auth.uid()
--  kaya "hindi admin" ang tingin nito. Ibabalik agad pagkatapos.
-- ---------------------------------------------------------------------
alter table public.profiles disable trigger trg_protect_profile;

select public.create_seed_user('admin@scs.test',     'Admin12345', 'SCS Admin',      'admin',     'active');
select public.create_seed_user('staff@scs.test',     'Staff12345', 'SCS Staff',      'staff',     'active');
select public.create_seed_user('homeowner@scs.test', 'Home12345',  'Juan Dela Cruz', 'homeowner', 'pending', '5', '12');

alter table public.profiles enable trigger trg_protect_profile;

-- Tanggalin ang helper (opsyonal — nililinis lang)
drop function if exists public.create_seed_user(text, text, text, text, text, text, text);

-- Tingnan ang resulta:
select email, role, status, block, lot
from public.profiles
order by role;

-- =====================================================================
--  TAPOS. Puwede ka nang mag-login gamit ang alinman sa 3 accounts.
-- =====================================================================
