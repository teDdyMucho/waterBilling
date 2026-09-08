-- =====================================================================
--  SCS BILLING PORTAL — Migration 0025
--  KUSANG BUKAS NG SUSUNOD NA CYCLE KAPAG SARADO NA ANG KASALUKUYAN
--
--  Kapag nabayaran na ang lahat ng bill sa isang cycle, isinasara na ito
--  ng 0017. Ngayon, sa parehong sandali, kusa nang bubuksan ang cycle para
--  sa SUSUNOD na buwan — batay sa mga petsa ng katatapos lang.
--
--  Paano kinukuha ang susunod:
--    code         : YYYY-MM ng susunod na buwan (hal. 2026-09 -> 2026-10)
--    reading_start: +1 buwan mula sa nakaraan (kung may nakatakda)
--    reading_end  : +1 buwan mula sa nakaraan
--    due_date     : +1 buwan mula sa nakaraan
--    grace_days   : kapareho ng nakaraan
--    status       : 'open'
--
--  TATLONG PROTEKSYON — hindi gagawa ng cycle kung:
--    1) may BUKAS nang cycle ('open' o 'reading') — hindi puwedeng dalawa
--       ang aktibo, dahil doon mapupunta ang mga basa;
--    2) may cycle nang ganoon ang code — hindi dumodoble;
--    3) walang mapagbatayang petsa — walang hinuhulaang wala sa datos.
--
--  Ligtas ulit-ulitin (idempotent).
-- =====================================================================

create or replace function public.sync_cycle_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.billing_cycles;
  v_next   date;
  v_code   text;
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

    -- ---------------------------------------------------------------
    --  Buksan ang susunod na buwan
    -- ---------------------------------------------------------------
    select * into c from public.billing_cycles where id = new.billing_cycle_id;

    -- Sa cycle na kasasara pa lang tayo gagawa ng susunod.
    if c.id is not null and c.status = 'closed' then

      -- (1) Huwag kung may bukas nang cycle
      if not exists (
        select 1 from public.billing_cycles
        where status in ('open', 'reading')
      ) then

        -- (3) Kailangan ng mapagbatayang petsa
        v_next := coalesce(c.reading_start, c.bill_date, c.due_date);

        if v_next is not null then
          v_code := to_char(v_next + interval '1 month', 'YYYY-MM');

          -- (2) Huwag kung meron nang ganitong code
          if not exists (select 1 from public.billing_cycles where code = v_code) then
            insert into public.billing_cycles (
              code, reading_start, reading_end, bill_date, due_date, grace_days, status
            ) values (
              v_code,
              case when c.reading_start is null then null
                   else (c.reading_start + interval '1 month')::date end,
              case when c.reading_end is null then null
                   else (c.reading_end + interval '1 month')::date end,
              case when c.bill_date is null then null
                   else (c.bill_date + interval '1 month')::date end,
              case when c.due_date is null then null
                   else (c.due_date + interval '1 month')::date end,
              c.grace_days,
              'open'
            );

            -- Ipaalam sa admin/staff na may bagong cycle nang bukas.
            insert into public.notifications (recipient_id, type, title, body, link)
            select p.id, 'cycle', 'Bukas na ang bagong billing cycle',
                   'Cycle ' || v_code || ' — puwede nang mag-encode ng basa.',
                   case when p.role = 'admin' then '/admin/cycles' else '/staff/readings' end
            from public.profiles p
            where p.role in ('admin', 'staff') and p.status = 'active';
          end if;
        end if;
      end if;
    end if;

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
