-- =====================================================================
--  SCS BILLING PORTAL — Migration 0023
--  AYUSIN: hindi makita ng homeowner ang litrato ng basang galing sa Unknown
--
--  Ang dating policy ay umaasa sa hugis ng path:
--      {cycle_code}/{meter_id}/{uuid}.jpg  ->  foldername(name)[2] = meter_id
--  at kina-cast ito nang diretso sa uuid.
--
--  Pero ang litrato ng Unknown / C.O. ay nasa:
--      {cycle_code}/unassigned/{kind}/{uuid}.jpg
--  kaya ang [2] ay ang salitang 'unassigned' — at ang '::uuid' na cast dito
--  ay HINDI lang tumatanggi, kundi NAGKAKA-ERROR (invalid input syntax for
--  type uuid). Kaya nabibigo ang pagbukas ng litrato sa panig ng homeowner
--  kahit ang basa ay naitalaga na sa metro niya.
--
--  Ayos: huwag nang hulaan mula sa path. Tingnan kung may meter_reading na
--  ang photo_path ay ang mismong file na ito, at kung kanya ba ang metrong
--  iyon. Tama ito anuman ang hugis ng path — kasama ang naitalagang Unknown.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- Mabilis na hanapan ng photo_path (ginagamit ng policy sa bawat file).
create index if not exists readings_photo_path_idx
  on public.meter_readings (photo_path);

drop policy if exists meterphotos_owner_read on storage.objects;

create policy meterphotos_owner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'meter-photos'
    and exists (
      select 1
      from public.meter_readings r
      where r.photo_path = storage.objects.name
        and public.owns_meter(r.meter_id)
    )
  );

-- =====================================================================
--  NOTE
--  Hindi nito binibigyan ng access ang homeowner sa mga basang NASA INBOX
--  pa (Unknown / C.O. na hindi pa naitatalaga) — tama iyon: hindi pa nga
--  alam kung kanino iyon. Kapag naitalaga na ng admin sa metro niya,
--  saka lang niya ito makikita.
-- =====================================================================
