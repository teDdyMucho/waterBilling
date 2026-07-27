-- =====================================================================
--  SCS BILLING PORTAL — Migration 0011
--  Phase 7: PAYMENTS — submit → endorse → confirm
--
--  I-run PAGKATAPOS ng 0001, 0004, 0008, 0009. Ligtas ulit-ulitin.
--
--  Daloy:
--   1) Homeowner mag-submit ng bayad + proof  → status 'submitted',
--      bill → 'payment_pending'
--   2) Staff mag-ENDORSE (o mag-reject)        → 'endorsed'
--   3) Admin mag-CONFIRM (o mag-reject)        → 'confirmed'  ← dito lang
--      nagiging bayad: mababawas sa balanse + may OR number
--
--  Seguridad: WALANG direktang UPDATE policy — lahat ng status change ay
--  sa RPC (security definer) na may role check. Kaya HINDI kayang i-set
--  ng staff na 'confirmed' via raw API.
-- =====================================================================

create sequence if not exists public.payment_seq;
create sequence if not exists public.receipt_seq;

-- ---------------------------------------------------------------------
-- 1)  payment_settings (isang row — channels + QR + instructions)
-- ---------------------------------------------------------------------
create table if not exists public.payment_settings (
  id                int primary key default 1 check (id = 1),
  gcash_number      text,
  gcash_name        text,
  maya_number       text,
  maya_name         text,
  bank_name         text,
  bank_account      text,
  bank_account_name text,
  qr_path           text,
  instructions      text,
  updated_at        timestamptz not null default now()
);
insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2)  payments
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  payment_no          text not null unique
                        default ('PAY-' || to_char(now(), 'YYYYMM') || '-' ||
                                 lpad(nextval('public.payment_seq')::text, 5, '0')),
  bill_id             uuid references public.bills (id) on delete set null,
  property_id         uuid references public.properties (id) on delete set null,
  submitted_by        uuid not null references public.profiles (id) on delete cascade,
  amount              numeric(12, 2) not null check (amount > 0),
  method              text not null check (method in ('gcash','maya','bank_transfer','cash')),
  reference_number    text,
  payment_date        date not null default current_date,
  proof_path          text,
  status              text not null default 'submitted'
                        check (status in ('submitted','endorsed','confirmed','rejected','voided')),
  endorsed_by         uuid references public.profiles (id),
  endorsed_at         timestamptz,
  endorse_remarks     text,
  confirmed_by        uuid references public.profiles (id),
  confirmed_at        timestamptz,
  rejection_reason    text,
  void_reason         text,
  official_receipt_no text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_submitter_idx on public.payments (submitted_by);
create index if not exists payments_bill_idx on public.payments (bill_id);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3)  payment_allocations (bayad → bill)
-- ---------------------------------------------------------------------
create table if not exists public.payment_allocations (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references public.payments (id) on delete cascade,
  bill_id       uuid not null references public.bills (id) on delete cascade,
  amount_applied numeric(12, 2) not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4)  audit_logs (immutable — para sa pera)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles (id),
  action       text not null,
  entity_table text,
  entity_id    uuid,
  old_values   jsonb,
  new_values   jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- 5)  Helper: i-recompute ang status ng bill base sa amount_paid + due
-- ---------------------------------------------------------------------
create or replace function public.recompute_bill_status(p_bill_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.bills;
  g int;
begin
  select * into b from public.bills where id = p_bill_id;
  if b.id is null or b.status = 'voided' then return; end if;
  select grace_days into g from public.billing_cycles where id = b.billing_cycle_id;

  update public.bills set status = case
    when b.amount_paid >= b.total_amount then 'paid'
    when b.amount_paid > 0 then 'partially_paid'
    when b.due_date is not null and current_date > (b.due_date + coalesce(g, 5)) then 'overdue'
    else 'unpaid'
  end
  where id = p_bill_id;
end $$;

-- ---------------------------------------------------------------------
-- 6)  Helper: abisuhan ang staff + admin (payment links)
-- ---------------------------------------------------------------------
create or replace function public.notify_payment_staff(p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, type, title, body, link)
  select p.id, 'payment', p_title, p_body,
    case p.role when 'staff' then '/staff/payments' when 'admin' then '/admin/payments' end
  from public.profiles p
  where p.role in ('staff','admin') and p.status = 'active';
end $$;

-- ---------------------------------------------------------------------
-- 7)  Trigger: bagong bayad → bill 'payment_pending' + abiso
-- ---------------------------------------------------------------------
create or replace function public.on_payment_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'submitted' and NEW.bill_id is not null then
    update public.bills set status = 'payment_pending'
    where id = NEW.bill_id and status in ('unpaid','overdue','partially_paid');
  end if;
  perform public.notify_payment_staff('Bagong bayad', 'Halaga: ₱' || NEW.amount::text);
  return NEW;
end $$;
drop trigger if exists trg_payment_submitted on public.payments;
create trigger trg_payment_submitted
  after insert on public.payments
  for each row execute function public.on_payment_submitted();

-- ---------------------------------------------------------------------
-- 8)  RPC: endorse_payment (staff/admin)
-- ---------------------------------------------------------------------
create or replace function public.endorse_payment(p_payment_id uuid, p_remarks text)
returns void language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Staff/admin lang.' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then raise exception 'Walang ganitong bayad.'; end if;
  if pay.status <> 'submitted' then raise exception 'Dapat submitted muna.'; end if;

  update public.payments
    set status = 'endorsed', endorsed_by = auth.uid(), endorsed_at = now(),
        endorse_remarks = p_remarks
  where id = p_payment_id;

  insert into public.audit_logs (actor_id, action, entity_table, entity_id)
  values (auth.uid(), 'endorse_payment', 'payments', p_payment_id);

  perform public.notify_payment_staff('Bayad para i-confirm', pay.payment_no);
end $$;
grant execute on function public.endorse_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9)  RPC: confirm_payment (ADMIN LANG) — dito nagiging bayad
-- ---------------------------------------------------------------------
create or replace function public.confirm_payment(p_payment_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  pay  public.payments;
  v_or text;
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makakapag-confirm.' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then raise exception 'Walang ganitong bayad.'; end if;
  if pay.status <> 'endorsed' then
    raise exception 'Dapat endorsed muna bago i-confirm.';
  end if;

  v_or := 'OR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 5, '0');

  update public.payments
    set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now(),
        official_receipt_no = v_or
  where id = p_payment_id;

  if pay.bill_id is not null then
    insert into public.payment_allocations (payment_id, bill_id, amount_applied)
    values (p_payment_id, pay.bill_id, pay.amount);

    update public.bills set amount_paid = amount_paid + pay.amount where id = pay.bill_id;
    update public.bills
      set status = case when amount_paid >= total_amount then 'paid' else 'partially_paid' end
    where id = pay.bill_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_table, entity_id, new_values)
  values (auth.uid(), 'confirm_payment', 'payments', p_payment_id,
          jsonb_build_object('or', v_or, 'amount', pay.amount));

  insert into public.notifications (recipient_id, type, title, body, link)
  values (pay.submitted_by, 'payment', 'Nakumpirma ang bayad mo',
          'Official Receipt: ' || v_or, '/dashboard/payments');

  return v_or;
end $$;
grant execute on function public.confirm_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10) RPC: reject_payment (staff endorse-reject o admin)
-- ---------------------------------------------------------------------
create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Staff/admin lang.' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then raise exception 'Walang ganitong bayad.'; end if;
  if pay.status not in ('submitted','endorsed') then
    raise exception 'Hindi na puwedeng tanggihan.';
  end if;

  update public.payments set status = 'rejected', rejection_reason = p_reason where id = p_payment_id;
  if pay.bill_id is not null then
    perform public.recompute_bill_status(pay.bill_id);
  end if;

  insert into public.audit_logs (actor_id, action, entity_table, entity_id, new_values)
  values (auth.uid(), 'reject_payment', 'payments', p_payment_id, jsonb_build_object('reason', p_reason));

  insert into public.notifications (recipient_id, type, title, body, link)
  values (pay.submitted_by, 'payment', 'Tinanggihan ang bayad', p_reason, '/dashboard/payments');
end $$;
grant execute on function public.reject_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11) RPC: void_payment (ADMIN — ibalik ang confirmed na bayad)
-- ---------------------------------------------------------------------
create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_admin() then
    raise exception 'Admin lang.' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then raise exception 'Walang ganitong bayad.'; end if;
  if pay.status <> 'confirmed' then raise exception 'Confirmed lang ang puwedeng i-void.'; end if;

  if pay.bill_id is not null then
    update public.bills set amount_paid = greatest(0, amount_paid - pay.amount) where id = pay.bill_id;
    delete from public.payment_allocations where payment_id = p_payment_id;
    perform public.recompute_bill_status(pay.bill_id);
  end if;

  update public.payments set status = 'voided', void_reason = p_reason where id = p_payment_id;

  insert into public.audit_logs (actor_id, action, entity_table, entity_id, new_values)
  values (auth.uid(), 'void_payment', 'payments', p_payment_id, jsonb_build_object('reason', p_reason));

  insert into public.notifications (recipient_id, type, title, body, link)
  values (pay.submitted_by, 'payment', 'Na-void ang bayad', p_reason, '/dashboard/payments');
end $$;
grant execute on function public.void_payment(uuid, text) to authenticated;

-- =====================================================================
-- 12) RLS  (WALANG update/delete policy — RPC lang ang nagbabago ng status)
-- =====================================================================
alter table public.payment_settings    enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.audit_logs          enable row level security;

-- payment_settings: lahat makakabasa; admin lang mag-edit
drop policy if exists psettings_select on public.payment_settings;
drop policy if exists psettings_write  on public.payment_settings;
create policy psettings_select on public.payment_settings for select to authenticated using (true);
create policy psettings_write on public.payment_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payments: homeowner sarili; staff/admin lahat. Insert: homeowner sarili.
drop policy if exists payments_select on public.payments;
drop policy if exists payments_insert on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (submitted_by = auth.uid() or public.is_staff_or_admin());
create policy payments_insert on public.payments for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'submitted'
    and (bill_id is null or exists (
      select 1 from public.bills b where b.id = bill_id and public.owns_property(b.property_id)
    ))
  );
-- (walang UPDATE/DELETE policy — kaya 403 ang raw na pag-set ng 'confirmed')

-- payment_allocations: sundin ang visibility ng payment
drop policy if exists alloc_select on public.payment_allocations;
create policy alloc_select on public.payment_allocations for select to authenticated
  using (
    exists (select 1 from public.payments p where p.id = payment_id
      and (p.submitted_by = auth.uid() or public.is_staff_or_admin()))
  );

-- audit_logs: admin lang
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- =====================================================================
-- 13) Storage: payment-proofs (private) + public-assets (public, QR)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('payment-proofs','payment-proofs',false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('public-assets','public-assets',true)
  on conflict (id) do nothing;

-- payment-proofs: homeowner sariling folder ({user_id}/…); staff/admin lahat
drop policy if exists proofs_select on storage.objects;
drop policy if exists proofs_insert on storage.objects;
create policy proofs_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (
    public.is_staff_or_admin() or (storage.foldername(name))[1] = auth.uid()::text
  ));
create policy proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- public-assets: admin write, public read (para sa QR)
drop policy if exists pubassets_read on storage.objects;
drop policy if exists pubassets_write on storage.objects;
create policy pubassets_read on storage.objects for select
  using (bucket_id = 'public-assets');
create policy pubassets_write on storage.objects for all to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

-- Realtime
do $$ begin
  begin alter publication supabase_realtime add table public.payments; exception when others then null; end;
end $$;

-- =====================================================================
--  TAPOS ang 0011. Susunod: Admin → Payment Settings; Homeowner → Pay Now.
-- =====================================================================
