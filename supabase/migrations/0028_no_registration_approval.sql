-- =====================================================================
--  SCS BILLING PORTAL — Migration 0028
--  WALA NANG SELF-REGISTRATION AT WALA NANG APPROVAL
--
--  Dati: kahit sino ay makakapag-register, at 'pending' ang account
--  hanggang aprubahan ng admin.
--
--  Ngayon: ang ADMIN lang ang gumagawa ng account (Account Management).
--  Wala nang aaprubahan — aktibo agad ang ginawa niya.
--
--  Dalawang bagay ang ginagawa nito:
--    1) Ang bagong signup ay 'rejected' agad — HINDI makakapasok.
--       Ang provisionUser() na tumatakbo sa session ng admin ang
--       nagbubukas nito kaagad pagkatapos gumawa ng account.
--       Bakit ganito: tinanggal na ang registration UI, pero ang anon key
--       ay nasa browser — kayang tawagin nang diretso ang /auth/v1/signup.
--       Ang trigger na ito ang tunay na depensa, hindi ang UI.
--    2) Ang mga naiwang 'pending' ay ginagawang 'active' — kung hindi,
--       maiiwan silang naka-kandado habang buhay: wala nang approval UI
--       na makakapag-aktibo sa kanila.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Bawat bagong signup = 'rejected' (sarado)
--
--     Ang admin ay gumagawa ng account sa pamamagitan ng hiwalay na client
--     na WALANG session, kaya walang auth.uid() dito — hindi masasabi ng
--     trigger kung admin ba ang gumawa. Kaya sarado ang lahat sa simula,
--     at ang provisionUser() ang nagbubukas nito kaagad.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, contact_number, block, lot, preferred_language,
    role, status, rejection_reason
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'contact_number',
    new.raw_user_meta_data ->> 'block',
    new.raw_user_meta_data ->> 'lot',
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'tl'),
    'homeowner',
    'rejected',
    'Sarado ang self-registration. Ang admin ang gumagawa ng account.'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2)  Ang mga naiwang 'pending' — buksan na
--     Sila ay nag-register noong bukas pa ito at naghihintay ng approval
--     na hindi na darating.
-- ---------------------------------------------------------------------
alter table public.profiles disable trigger trg_protect_profile;

update public.profiles
   set status      = 'active',
       approved_at = coalesce(approved_at, now()),
       updated_at  = now()
 where status = 'pending';

alter table public.profiles enable trigger trg_protect_profile;

-- ---------------------------------------------------------------------
--  I-verify — dapat walang natirang 'pending'
-- ---------------------------------------------------------------------
select status, count(*) from public.profiles group by status order by status;
