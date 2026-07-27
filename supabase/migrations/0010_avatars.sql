-- =====================================================================
--  SCS BILLING PORTAL — Migration 0010
--  Profile avatars: image kung meron, initials kung wala.
--
--  I-run PAGKATAPOS ng 0001. Ligtas ulit-ulitin.
-- =====================================================================

-- 1) avatar_url column sa profiles
alter table public.profiles add column if not exists avatar_url text;

-- (Ang avatar_url ay hindi protektado ng protect_profile_columns, kaya
--  kayang i-update ng bawat user ang SARILI niyang avatar via profiles_update_own.)

-- 2) Public storage bucket para sa avatars (profile pics — hindi sensitibo)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Path convention: {user_id}/{uuid}.jpg  → foldername[1] = user_id
drop policy if exists avatars_read on storage.objects;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_update on storage.objects;

-- Public read (para makita kahit saan nang walang signed URL)
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

-- Sariling avatar lang ang puwedeng i-upload/palitan
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
--  TAPOS ang 0010.
-- =====================================================================
