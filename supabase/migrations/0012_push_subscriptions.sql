-- =====================================================================
--  SCS BILLING PORTAL — Migration 0012
--  PWA: WEB PUSH SUBSCRIPTIONS
--
--  I-run PAGKATAPOS ng 0001 (profiles) at 0004 (is_staff_or_admin helper).
--  Ligtas ulit-ulitin (idempotent).
--
--  Dito itinatago ang push subscription ng bawat device/browser ng user.
--  Ang aktuwal na pagpapadala ng notification ay ginagawa ng Edge Function
--  `send-push` gamit ang service-role key (by-pass ang RLS) + VAPID keys.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- --- Policies --------------------------------------------------------
-- Nakikita ng user ang sarili niyang subscriptions; nakikita rin ng
-- staff/admin (para malaman kung sinong maaabot).
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff_or_admin());

-- Ang user lang ang makakapag-register ng sarili niyang device.
drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_subs_update on public.push_subscriptions;
create policy push_subs_update on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Ang user (o admin, para mag-prune ng patay na subs) ang makakabura.
drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid() or public.is_staff_or_admin());

comment on table public.push_subscriptions is
  'Web Push subscriptions per device. Ginagamit ng send-push Edge Function.';
