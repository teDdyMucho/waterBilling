-- =====================================================================
--  SCS BILLING PORTAL — Migration 0024
--  DIRETSO NA SA ADMIN ANG CONFIRMATION NG BAYAD
--
--  Dati: homeowner -> staff (endorse) -> admin (confirm).
--  Ngayon: homeowner -> admin (confirm). Ang staff ay TUMITINGIN lang —
--  nakikita nila kung natanggap at nakumpirma na ba ng admin.
--
--  Ano ang binago:
--    * confirm_payment — tinatanggap na ang 'submitted', hindi na kailangang
--      dumaan sa 'endorsed'. (Tinatanggap pa rin ang 'endorsed' para sa
--      mga bayad na naipasa na bago ang pagbabagong ito.)
--    * reject_payment — admin lang. Ang staff ay hindi na nagdedesisyon.
--    * endorse_payment — hindi na ginagamit; ibinabagsak nito ang tawag
--      nang may malinaw na paliwanag imbes na tahimik na magpatuloy.
--
--  Ang status na 'endorsed' ay nananatili sa schema — may mga lumang rekord
--  na ganoon, at hindi tama na burahin ang kasaysayan.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1)  confirm_payment — mula sa 'submitted' (o lumang 'endorsed')
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
  if pay.status not in ('submitted', 'endorsed') then
    raise exception 'Naaksyunan na ang bayad na ito.';
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
-- 2)  reject_payment — ADMIN na lang
--     Kung ang staff ang makakatanggi, sila pa rin ang nagdedesisyon —
--     at iyon mismo ang inaalis natin.
-- ---------------------------------------------------------------------
create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makakatanggi ng bayad.' using errcode = '42501';
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
-- 3)  endorse_payment — wala nang saysay
--     Iniiwan ang function pero ibinabagsak nito ang tawag, para kung may
--     natirang lumang button kahit saan, malinaw ang sasabihin nito imbes
--     na tahimik na magpalit ng status at maantala ang bayad.
-- ---------------------------------------------------------------------
create or replace function public.endorse_payment(p_payment_id uuid, p_remarks text)
returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception
    'Wala nang endorsement. Ang admin na ang direktang nagko-confirm ng bayad.'
    using errcode = '42501';
end $$;

grant execute on function public.endorse_payment(uuid, text) to authenticated;
