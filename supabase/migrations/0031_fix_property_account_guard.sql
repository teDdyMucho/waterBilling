-- =====================================================================
--  SCS BILLING PORTAL — Migration 0031
--  AYUSIN: hindi makapag-save ng property ang STAFF
--
--  Ang nangyayari:
--    Ang create_property_with_account (0029) ay nag-a-update ng role at
--    status ng bagong profile. May BEFORE UPDATE trigger sa profiles
--    (protect_profile_columns, 0001) na nagbabawal nito maliban kung
--    ADMIN ang tumatawag.
--
--    Ang function ay security definer — tumatakbo bilang owner — pero ang
--    auth.uid() ay ang TUNAY na tumatawag pa rin. Kaya kapag STAFF ang
--    gumagawa ng property, tumitigil ang trigger, bumabagsak ang buong
--    transaksyon, at WALANG naitatala: walang property, walang account,
--    at walang malinaw na dahilan sa staff.
--
--  Ayos: isang transaction-local na bandila. Ang trigger ay dumadaan
--  lang kapag itinakda ito ng mga function nating pinagkakatiwalaan.
--  Hindi ito mababago ng browser — ang mga function na ito lang ang
--  nagtatakda nito, at nawawala ito pagkatapos ng transaksyon.
--
--  (Ang alternatibo ay i-disable ang trigger sa loob ng function, pero
--   kumukuha iyon ng ACCESS EXCLUSIVE lock sa buong talahanayan — masyadong
--   malaki ang epekto para sa isang row.)
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Ang trigger — may pinapayagang daanan
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin: walang hadlang
  if public.is_admin() then
    return new;
  end if;

  -- Mga pinagkakatiwalaang function ng server (hal. ang paggawa ng
  -- property + account). Transaction-local ang bandila at ang mga
  -- function lang ang nagtatakda nito.
  if coalesce(current_setting('app.trusted_profile_write', true), '') = 'on' then
    return new;
  end if;

  -- Hindi admin: dapat pareho pa rin ang mga sensitibong field
  if new.id           is distinct from old.id
     or new.role         is distinct from old.role
     or new.status       is distinct from old.status
     or new.approved_by  is distinct from old.approved_by
     or new.approved_at  is distinct from old.approved_at
     or new.email        is distinct from old.email then
    raise exception 'Hindi pinapayagang baguhin ang role/status/approval/email ng profile.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2)  create_property_with_account — itakda ang bandila bago mag-update
--     (kapareho ng 0029 maliban sa isang linya bago ang update)
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

  -- Ito ang nawawala sa 0029: pinapayagan ang pagbabago ng role/status
  -- ng BAGONG profile kahit staff ang gumagawa. Transaction-local lang.
  perform set_config('app.trusted_profile_write', 'on', true);

  update public.profiles
     set role               = 'homeowner',
         status             = 'active',
         block              = trim(p_block),
         lot                = trim(p_lot),
         rejection_reason   = null,
         approved_at        = now(),
         setup_completed_at = null,
         updated_at         = now()
   where id = v_uid;

  perform set_config('app.trusted_profile_write', 'off', true);

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
-- 3)  complete_homeowner_setup — kailangan din nito ang daanan
--     (hindi admin ang homeowner, at hinahawakan nito ang sariling row)
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

  perform set_config('app.trusted_profile_write', 'on', true);

  update public.profiles
     set full_name          = trim(p_full_name),
         setup_completed_at = now(),
         updated_at         = now()
   where id = v_uid;

  perform set_config('app.trusted_profile_write', 'off', true);

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
