-- =====================================================================
--  SCS BILLING PORTAL — Migration 0017
--  AUTO-CLOSE ng billing cycle kapag BAYAD na LAHAT
--
--  Kapag naging 'paid' na ang lahat ng bill sa isang cycle (o 'voided'),
--  awtomatikong nagiging 'closed' ang cycle (mula 'billed'). Kung may
--  na-void na bayad at may bill na bumalik sa hindi-bayad, nagbubukas ulit
--  ('closed' → 'billed').
--
--  Trigger-based — hindi hinahawakan ang confirm_payment/void_payment RPCs.
--  I-run PAGKATAPOS ng 0008 (bills) + 0011 (payments). Ligtas ulit-ulitin.
-- =====================================================================

create or replace function public.sync_cycle_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.billing_cycle_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.bills b
    where b.billing_cycle_id = new.billing_cycle_id
      and b.status not in ('paid', 'voided')
  ) then
    -- Lahat bayad/void na → isara
    update public.billing_cycles
       set status = 'closed', updated_at = now()
     where id = new.billing_cycle_id and status = 'billed';
  else
    -- May hindi pa bayad → buksang muli kung nakasara
    update public.billing_cycles
       set status = 'billed', updated_at = now()
     where id = new.billing_cycle_id and status = 'closed';
  end if;

  return new;
end $$;

drop trigger if exists trg_sync_cycle_closed on public.bills;
create trigger trg_sync_cycle_closed
  after update of status on public.bills
  for each row
  execute function public.sync_cycle_closed();

-- One-time backfill: isara ang mga 'billed' cycle na may bill at bayad na lahat.
update public.billing_cycles c
   set status = 'closed', updated_at = now()
 where c.status = 'billed'
   and exists (select 1 from public.bills b where b.billing_cycle_id = c.id)
   and not exists (
     select 1 from public.bills b
     where b.billing_cycle_id = c.id and b.status not in ('paid', 'voided')
   );
