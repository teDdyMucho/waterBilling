-- =====================================================================
--  SCS BILLING PORTAL — Migration 0029
--  ANG PAG-ADD NG PROPERTY AY GUMAGAWA NA RIN NG HOMEOWNER ACCOUNT
--
--  Daloy:
--    1) Sa pag-encode, kapag wala sa listahan ang hinahanap na property,
--       may Add — doon ilalagay ang Block, Lot, at ang metro.
--    2) Sa pag-save: gagawa ng property + metro + HOMEOWNER ACCOUNT nang
--       sabay. Ang email ay galing sa lote (blk1lot27@scs.local) at ang
--       password ay '123456' para sa lahat.
--    3) Ibinibigay ng staff/admin ang link + credentials sa homeowner.
--    4) Sa unang login, may required na setup (pangalan at address).
--       Pagkatapos nito, saka lang sila makakapasok sa dashboard.
--
--  MAHALAGANG DESISYON — bakit hindi 'pending' ang status:
--    Kailangang MAKAPAG-LOGIN ang homeowner para makapag-setup. Kapag
--    'pending' ang status, hinaharangan siya ng guard at hindi na siya
--    makakapasok kailanman. Kaya 'active' ang status, at hiwalay na
--    marka ang ginagamit: setup_completed_at. NULL = hindi pa naka-setup.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Marka kung naka-setup na ang homeowner
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists setup_completed_at timestamptz;

comment on column public.profiles.setup_completed_at is
  'NULL = bagong account na hindi pa napupunan ng homeowner ang pangalan at address.';

-- Ang mga umiiral nang account ay ituring nang tapos — hindi sila
-- dumaan sa bagong daloy at hindi tama na piliting mag-setup.
update public.profiles
   set setup_completed_at = coalesce(setup_completed_at, created_at)
 where setup_completed_at is null
   and id in (select id from auth.users where created_at < now());

-- ---------------------------------------------------------------------
-- 2)  Email mula sa lote: "Blk 1" + "Lot 27" -> blk1lot27@scs.local
--     Kapag may kapareho na, dinadagdagan ng numero.
-- ---------------------------------------------------------------------
create or replace function public.email_for_lot(p_block text, p_lot text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_slug text;
  v_try  text;
  i      int := 1;
begin
  v_slug := lower(regexp_replace(coalesce(p_block, '') || coalesce(p_lot, ''), '[^a-zA-Z0-9]', '', 'g'));
  if v_slug = '' then v_slug := 'lote'; end if;

  v_try := v_slug || '@scs.local';
  while exists (select 1 from auth.users where email = v_try) loop
    i := i + 1;
    v_try := v_slug || i::text || '@scs.local';
  end loop;
  return v_try;
end;
$$;

grant execute on function public.email_for_lot(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3)  Gumawa ng property + metro + homeowner account (staff/admin)
--
--     Isang transaksyon ang lahat: kung may pumalya, walang matitirang
--     kalahating property na walang account o kabaligtaran.
-- ---------------------------------------------------------------------
create or replace function public.create_property_with_account(
  p_block         text,
  p_lot           text,
  p_water_meter   text default null,
  p_electric_meter text default null,
  p_installed_at  date default null
) returns json
language plpgsql security definer set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_pass  text := '123456';
  v_uid   uuid;
  v_prop  uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Staff/admin lang ang makakagawa ng property.' using errcode = '42501';
  end if;

  if coalesce(trim(p_block), '') = '' or coalesce(trim(p_lot), '') = '' then
    raise exception 'Kailangan ang Block at Lot.';
  end if;

  if exists (
    select 1 from public.properties
    where lower(trim(block)) = lower(trim(p_block))
      and lower(trim(lot))   = lower(trim(p_lot))
  ) then
    raise exception 'May ganitong Block at Lot na.';
  end if;

  -- ---- Ang account -------------------------------------------------
  v_email := public.email_for_lot(p_block, p_lot);
  v_uid   := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_uid, 'authenticated', 'authenticated', v_email,
    crypt(v_pass, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', '', 'contact_number', '',
      'block', trim(p_block), 'lot', trim(p_lot), 'preferred_language', 'tl'
    ),
    '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  -- Ang handle_new_user trigger ay gumagawa nito bilang 'rejected'
  -- (sarado ang self-registration) — itinatama dito.
  update public.profiles
     set role               = 'homeowner',
         status             = 'active',
         block              = trim(p_block),
         lot                = trim(p_lot),
         rejection_reason   = null,
         approved_at        = now(),
         setup_completed_at = null,   -- kailangan pang mag-setup
         updated_at         = now()
   where id = v_uid;

  -- ---- Ang property at metro ---------------------------------------
  insert into public.properties (block, lot, status)
  values (trim(p_block), trim(p_lot), 'occupied')
  returning id into v_prop;

  insert into public.property_owners (property_id, profile_id, is_primary)
  values (v_prop, v_uid, true);

  insert into public.meters (property_id, utility_type, meter_number, installed_at, status)
  values (v_prop, 'water', nullif(trim(coalesce(p_water_meter, '')), ''), p_installed_at, 'active');

  insert into public.meters (property_id, utility_type, meter_number, installed_at, status)
  values (v_prop, 'electric', nullif(trim(coalesce(p_electric_meter, '')), ''), p_installed_at, 'active');

  insert into public.audit_logs (actor_id, action, entity_table, entity_id, new_values)
  values (auth.uid(), 'create_property_with_account', 'properties', v_prop,
          jsonb_build_object('email', v_email, 'block', trim(p_block), 'lot', trim(p_lot)));

  return json_build_object(
    'property_id', v_prop,
    'profile_id',  v_uid,
    'email',       v_email,
    'password',    v_pass
  );
end;
$$;

grant execute on function public.create_property_with_account(text, text, text, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4)  Setup ng homeowner sa unang login — pangalan at address
-- ---------------------------------------------------------------------
create or replace function public.complete_homeowner_setup(
  p_full_name text,
  p_address   text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Kailangang naka-login.' using errcode = '42501';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Kailangan ang pangalan.';
  end if;

  update public.profiles
     set full_name          = trim(p_full_name),
         setup_completed_at = now(),
         updated_at         = now()
   where id = v_uid;

  -- Ang address ay napupunta sa property na hawak niya.
  update public.properties p
     set address_line = nullif(trim(coalesce(p_address, '')), ''),
         updated_at   = now()
    from public.property_owners po
   where po.property_id = p.id
     and po.profile_id = v_uid
     and po.end_date is null;
end;
$$;

grant execute on function public.complete_homeowner_setup(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5)  Makita ng STAFF ang setup status ng homeowner
--     (may select policy na sila sa homeowner profiles mula 0005)
-- ---------------------------------------------------------------------
select p.block, p.lot, p.setup_completed_at, u.email
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'homeowner'
order by p.block, p.lot;
