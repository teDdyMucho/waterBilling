-- =====================================================================
--  SCS BILLING PORTAL — Migration 0032
--  WELCOME LINK — isang link lang ang ibinibigay sa bagong homeowner
--
--  Dati: kinokopya ng staff ang app link + email + password at ipinapadala.
--  Ngayon: isang link lang — /welcome/<token>. Kapag binuksan ito ng
--  homeowner, may pahinang nagpapaliwanag ng sistema, ng mga hakbang, at ng
--  mga kailangan niyang ilagay — saka lang siya dadalhin sa login.
--
--  1) profiles.invite_token — lihim, random na UUID kada account. Ito ang
--     nasa link. Hindi ito ang id ng profile para hindi mahulaan.
--  2) welcome_info(token) — pampublikong RPC (kahit hindi naka-login) na
--     nagbabalik LANG ng block, lot, email, at kung tapos na ang setup.
--     Walang ibang personal na datos ang lumalabas.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  Token sa bawat profile (ang default ang nagpupuno sa mga luma)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists invite_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_invite_token_key
  on public.profiles (invite_token);

-- ---------------------------------------------------------------------
-- 2)  welcome_info — text ang parameter para hindi bumagsak sa maling
--     format ng UUID; NULL ang balik kapag walang tumugma.
-- ---------------------------------------------------------------------
create or replace function public.welcome_info(p_token text)
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'block',      p.block,
    'lot',        p.lot,
    'email',      p.email,
    'status',     p.status,
    'setup_done', p.setup_completed_at is not null
  )
  from public.profiles p
  where p.role = 'homeowner'
    and p.invite_token::text = p_token
  limit 1;
$$;

revoke all on function public.welcome_info(text) from public;
grant execute on function public.welcome_info(text) to anon, authenticated;

-- Para makita agad ng PostgREST ang bagong function at column
notify pgrst, 'reload schema';
