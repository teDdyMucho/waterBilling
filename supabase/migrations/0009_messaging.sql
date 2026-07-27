-- =====================================================================
--  SCS BILLING PORTAL — Migration 0009
--  Phase 6: Messaging (concerns), Notifications, Announcements
--
--  I-run PAGKATAPOS ng 0001, 0004. Ligtas ulit-ulitin.
--
--  Daloy: homeowner mag-open ng concern → staff sasagot / mag-internal note
--         / mag-escalate sa admin → admin sasagot / magre-resolve.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  message_threads (concerns)
-- ---------------------------------------------------------------------
create sequence if not exists public.ticket_seq;

create table if not exists public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  ticket_no       text not null unique
                    default ('TKT-' || lpad(nextval('public.ticket_seq')::text, 6, '0')),
  property_id     uuid references public.properties (id) on delete set null,
  opened_by       uuid not null references public.profiles (id) on delete cascade,
  category        text not null default 'others'
                    check (category in ('billing','meter','requirements','complaint','others')),
  subject         text not null,
  priority        text not null default 'normal' check (priority in ('low','normal','high')),
  status          text not null default 'open'
                    check (status in ('open','in_progress','escalated','resolved','closed')),
  assigned_to     uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists threads_opened_idx on public.message_threads (opened_by);
create index if not exists threads_status_idx on public.message_threads (status);

drop trigger if exists trg_threads_updated_at on public.message_threads;
create trigger trg_threads_updated_at
  before update on public.message_threads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2)  messages
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  thread_id        uuid not null references public.message_threads (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null default '',
  attachments      jsonb not null default '[]'::jsonb,  -- [{path,name}]
  is_internal_note boolean not null default false,       -- staff/admin lang
  created_at       timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

-- ---------------------------------------------------------------------
-- 3)  notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type         text not null default 'message',
  title        text not null,
  body         text,
  link         text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists notif_recipient_idx on public.notifications (recipient_id, is_read);

-- ---------------------------------------------------------------------
-- 4)  announcements
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null default '',
  audience     text not null default 'all' check (audience in ('all','homeowners','staff','block')),
  target_block text,
  is_public    boolean not null default false,
  posted_by    uuid references public.profiles (id),
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5)  Helper: notify + fan-out sa staff/admin
-- ---------------------------------------------------------------------
create or replace function public.link_for_role(p_role text, p_thread uuid)
returns text language sql immutable as $$
  select case p_role
    when 'homeowner' then '/dashboard/messages/' || p_thread
    when 'staff'     then '/staff/concerns/' || p_thread
    when 'admin'     then '/admin/concerns/' || p_thread
  end;
$$;

create or replace function public.notify_staff_admin(p_title text, p_body text, p_thread uuid, p_exclude uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, type, title, body, link)
  select p.id, 'message', p_title, p_body, public.link_for_role(p.role, p_thread)
  from public.profiles p
  where p.role in ('staff','admin') and p.status = 'active'
    and (p_exclude is null or p.id <> p_exclude);
end;
$$;

-- ---------------------------------------------------------------------
-- 6)  Trigger: bagong thread → abisuhan ang staff/admin
-- ---------------------------------------------------------------------
create or replace function public.on_thread_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_staff_admin('Bagong concern', NEW.subject, NEW.id, NEW.opened_by);
  return NEW;
end;
$$;
drop trigger if exists trg_thread_created on public.message_threads;
create trigger trg_thread_created
  after insert on public.message_threads
  for each row execute function public.on_thread_created();

-- ---------------------------------------------------------------------
-- 7)  Trigger: bagong mensahe → last_message_at + notification
-- ---------------------------------------------------------------------
create or replace function public.on_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  th        public.message_threads;
  rec_role  text;
begin
  select * into th from public.message_threads where id = NEW.thread_id;
  update public.message_threads set last_message_at = now() where id = NEW.thread_id;

  if NEW.is_internal_note then
    return NEW;  -- internal notes: walang abiso sa homeowner
  end if;

  if NEW.sender_id = th.opened_by then
    -- homeowner ang nag-reply → abisuhan staff/admin
    perform public.notify_staff_admin('Reply sa concern', left(NEW.body, 120), th.id, NEW.sender_id);
  else
    -- staff/admin ang nag-reply → abisuhan ang homeowner
    select role into rec_role from public.profiles where id = th.opened_by;
    insert into public.notifications (recipient_id, type, title, body, link)
    values (th.opened_by, 'message', 'Bagong reply', left(NEW.body, 120),
            public.link_for_role(coalesce(rec_role,'homeowner'), th.id));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_new_message on public.messages;
create trigger trg_new_message
  after insert on public.messages
  for each row execute function public.on_new_message();

-- =====================================================================
-- 8)  RLS
-- =====================================================================
alter table public.message_threads enable row level security;
alter table public.messages        enable row level security;
alter table public.notifications   enable row level security;
alter table public.announcements   enable row level security;

-- ---- message_threads ------------------------------------------------
drop policy if exists threads_select on public.message_threads;
drop policy if exists threads_insert on public.message_threads;
drop policy if exists threads_update_staff on public.message_threads;

create policy threads_select on public.message_threads for select to authenticated
  using (opened_by = auth.uid() or public.is_staff_or_admin());
create policy threads_insert on public.message_threads for insert to authenticated
  with check (opened_by = auth.uid());
create policy threads_update_staff on public.message_threads for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- ---- messages -------------------------------------------------------
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;

create policy messages_select on public.messages for select to authenticated
  using (
    (public.is_staff_or_admin()
      and exists (select 1 from public.message_threads th where th.id = thread_id))
    or (is_internal_note = false
      and exists (select 1 from public.message_threads th where th.id = thread_id and th.opened_by = auth.uid()))
  );

create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (is_internal_note = false or public.is_staff_or_admin())
    and exists (
      select 1 from public.message_threads th
      where th.id = thread_id and (th.opened_by = auth.uid() or public.is_staff_or_admin())
    )
  );

-- ---- notifications --------------------------------------------------
drop policy if exists notif_select on public.notifications;
drop policy if exists notif_update on public.notifications;

create policy notif_select on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---- announcements --------------------------------------------------
drop policy if exists announce_select on public.announcements;
drop policy if exists announce_public on public.announcements;
drop policy if exists announce_write_admin on public.announcements;

create policy announce_select on public.announcements for select to authenticated using (true);
create policy announce_public on public.announcements for select to anon using (is_public = true);
create policy announce_write_admin on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 9)  Storage bucket: message-attachments (private)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- Path convention: {thread_id}/{uuid}.ext  → foldername[1] = thread_id
drop policy if exists msgatt_select on storage.objects;
drop policy if exists msgatt_insert on storage.objects;

create policy msgatt_select on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments' and (
      public.is_staff_or_admin()
      or exists (
        select 1 from public.message_threads th
        where th.id::text = (storage.foldername(name))[1] and th.opened_by = auth.uid()
      )
    )
  );
create policy msgatt_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments' and (
      public.is_staff_or_admin()
      or exists (
        select 1 from public.message_threads th
        where th.id::text = (storage.foldername(name))[1] and th.opened_by = auth.uid()
      )
    )
  );

-- =====================================================================
-- 10) Realtime
-- =====================================================================
do $$
begin
  perform 1;
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when others then null; end;
  begin alter publication supabase_realtime add table public.message_threads; exception when others then null; end;
end $$;

-- =====================================================================
--  TAPOS ang 0009.
-- =====================================================================
