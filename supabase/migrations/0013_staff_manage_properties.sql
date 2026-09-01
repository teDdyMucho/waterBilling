-- =====================================================================
--  SCS BILLING PORTAL — Migration 0013
--  PAYAGAN ANG STAFF na mag-manage ng properties / meters / owners
--
--  I-run PAGKATAPOS ng 0004. Ligtas ulit-ulitin (idempotent).
--
--  Dati: admin LANG ang makakasulat (is_admin).
--  Ngayon: staff at admin (is_staff_or_admin) — pero ang PAGBURA ng buong
--  lote/meter ay admin PA RIN (delikado, may kasamang readings/bills history).
--  Ang pag-link/unlink ng owner ay pwede na ng staff.
-- =====================================================================

-- ---- PROPERTIES: staff pwedeng mag-add/edit; delete = admin lang ---------
drop policy if exists properties_write_admin  on public.properties;
drop policy if exists properties_insert_staff on public.properties;
drop policy if exists properties_update_staff on public.properties;
drop policy if exists properties_delete_admin on public.properties;

create policy properties_insert_staff on public.properties for insert to authenticated
  with check (public.is_staff_or_admin());
create policy properties_update_staff on public.properties for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy properties_delete_admin on public.properties for delete to authenticated
  using (public.is_admin());

-- ---- METERS: staff pwedeng mag-add/edit/replace; delete = admin lang -----
drop policy if exists meters_write_admin  on public.meters;
drop policy if exists meters_insert_staff on public.meters;
drop policy if exists meters_update_staff on public.meters;
drop policy if exists meters_delete_admin on public.meters;

create policy meters_insert_staff on public.meters for insert to authenticated
  with check (public.is_staff_or_admin());
create policy meters_update_staff on public.meters for update to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy meters_delete_admin on public.meters for delete to authenticated
  using (public.is_admin());

-- ---- PROPERTY OWNERS: staff pwedeng mag-link/unlink ----------------------
drop policy if exists property_owners_write_admin on public.property_owners;
drop policy if exists property_owners_write_staff on public.property_owners;

create policy property_owners_write_staff on public.property_owners for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
