-- =====================================================================
--  SCS BILLING PORTAL — Migration 0014
--  SAMPLE / TEST payment QR
--
--  Naglalagay ng halimbawang QR (public/qr-sample.png) sa payment_settings
--  PARA SA TESTING — makikita ng homeowner sa "Magbayad" at sa Gabay sa Bayad,
--  at ng admin sa Payment Settings.
--
--  LIGTAS: itinatakda LANG kapag WALA pang QR (hindi binabago ang tunay na QR).
--  Kapag nag-upload ang admin ng tunay na GCash/Maya QR sa Payment Settings,
--  papalitan nito ang sample. Ligtas ulit-ulitin.
-- =====================================================================

insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

update public.payment_settings
   set qr_path = '/qr-sample.png',
       updated_at = now()
 where id = 1
   and (qr_path is null or qr_path = '');
