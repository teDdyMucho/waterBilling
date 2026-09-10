-- =====================================================================
--  DIAGNOSTIC — bakit hindi nagagawa ang property + account?
--  Isang resulta lang ang lalabas; basahin ang bawat linya.
--  Ang inaasahan ay 'OK' lahat. Ang 'KULANG' ang nagsasabi kung aling
--  migration ang hindi pa na-run.
-- =====================================================================

select 'function: create_property_with_account (0029)' as tsek,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'create_property_with_account')
            then 'OK' else 'KULANG — i-run ang 0029' end as resulta
union all
select 'function: email_for_lot (0029)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'email_for_lot')
            then 'OK' else 'KULANG — i-run ang 0029' end
union all
select 'function: complete_homeowner_setup (0029)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'complete_homeowner_setup')
            then 'OK' else 'KULANG — i-run ang 0029' end
union all
select 'column: profiles.setup_completed_at (0029)',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'profiles'
                           and column_name = 'setup_completed_at')
            then 'OK' else 'KULANG — i-run ang 0029' end
union all
select 'trigger bypass sa protect_profile_columns (0031)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'protect_profile_columns'
                           and position('trusted_profile_write' in pg_get_functiondef(p.oid)) > 0)
            then 'OK' else 'KULANG — i-run ang 0031' end
union all
select 'bypass sa loob ng create_property_with_account (0031)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'create_property_with_account'
                           and position('trusted_profile_write' in pg_get_functiondef(p.oid)) > 0)
            then 'OK' else 'KULANG — i-run ang 0031' end
union all
select 'column: billing_cycles.property_id (dapat WALA na, 0030)',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'billing_cycles'
                           and column_name = 'property_id')
            then 'MERON PA — i-run ang 0030' else 'OK' end
union all
select 'handle_new_user: rejected ang bagong signup (0028)',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'handle_new_user'
                           and position('''rejected''' in pg_get_functiondef(p.oid)) > 0)
            then 'OK' else 'KULANG — i-run ang 0028' end
union all
select 'bilang ng properties', count(*)::text from public.properties
union all
select 'bilang ng homeowner accounts',
       count(*)::text from public.profiles where role = 'homeowner'
union all
select 'huling audit: create_property_with_account',
       coalesce((select to_char(max(created_at), 'YYYY-MM-DD HH24:MI') from public.audit_logs
                 where action = 'create_property_with_account'), 'wala pa');
