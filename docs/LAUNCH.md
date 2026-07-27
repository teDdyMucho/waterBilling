# Launch Runbook — SCS Billing Portal

Go-live checklist para sa **Santa Cicilia Subdivision** billing portal.
Sundin ang pagkakasunod. I-check (✅) bawat hakbang.

---

## 1. Database — patakbuhin lahat ng migration (in order)

Sa **Supabase → SQL Editor**, i-run isa-isa (o i-paste lahat sabay-sabay):

| # | File | Ano |
|---|---|---|
| 0001 | `supabase/migrations/0001_auth_profiles.sql` | profiles, roles, RLS |
| 0002 | `0002_make_admin.sql` | (opsyonal) i-promote ang admin mo |
| 0003 | `0003_seed_test_users.sql` | (opsyonal) test accounts — **huwag sa production** |
| 0004 | `0004_properties_meters.sql` | properties, meters |
| 0005 | `0005_staff_view_homeowners.sql` | staff makita homeowner names |
| 0006 | `0006_phase2_extras.sql` | zone, meter replacement |
| 0007 | `0007_readings.sql` | billing cycles, meter readings, photo bucket |
| 0008 | `0008_billing.sql` | rates, bills, penalties |
| 0009 | `0009_messaging.sql` | messages, notifications, attachments |
| 0010 | `0010_avatars.sql` | profile avatars |
| 0011 | `0011_payments.sql` | payments, allocations, audit |

> Idempotent lahat — ligtas ulit-ulitin.

---

## 2. Supabase settings

- [ ] **Authentication → Providers → Email → Confirm email = OFF**
      (ang admin approval ang gate, hindi email confirmation)
- [ ] **Authentication → URL Configuration:**
  - **Site URL:** `https://<your-domain>` (hal. `scs-billing.netlify.app`)
  - **Redirect URLs:** `https://<your-domain>/**` at `http://localhost:5173/**`
- [ ] **Authentication → Rate Limits:** paigtingin ang sign-up/OTP limits para iwas abuse
- [ ] **(Para sa password reset email)** Kung gagamitin, mag-setup ng custom **SMTP**
      (hal. Resend) sa **Project Settings → Auth → SMTP**. Ang default na Supabase
      email ay limitado (ilang beses kada oras).
- [ ] **Storage:** kumpirmahin na private ang `meter-photos`, `payment-proofs`,
      `message-attachments`; public ang `avatars`, `public-assets`.

---

## 3. Hosting (Netlify)

- [ ] Naka-connect ang GitHub repo sa Netlify (auto-deploy sa `main`)
- [ ] Env vars nasa `netlify.toml` na (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
      `VITE_APP_NAME`) — o sa Netlify UI
- [ ] **Custom domain** (opsyonal): Netlify → Domain management → Add domain →
      i-update ang DNS. Tapos idagdag ang bagong domain sa Supabase URL Configuration (#2).
- [ ] Kumpirmahin ang SPA redirect at security headers (nasa `netlify.toml` na).

---

## 4. Unang admin

1. Mag-register sa `/register` gamit ang email ng HOA admin.
2. Sa SQL Editor: `update public.profiles set role='admin', status='active' where email='...';`
   (o gamitin ang `0002_make_admin.sql`).
3. Mag-login → **Admin Console**.

---

## 5. Setup ng datos (bilang admin)

- [ ] **Payment Settings** → ilagay ang GCash/Maya/bank + i-upload ang **QR**
- [ ] **Rate at Singil** → itakda ang tubig/kuryente/dues/penalty
- [ ] **Lote at Metro** → idagdag ang mga lote + metro (o **CSV import**)
- [ ] **Account Management** → gumawa ng staff account(s); i-approve ang mga homeowner
- [ ] I-link ang bawat homeowner sa tamang lote

---

## 6. Backup & monitoring

- [ ] **Backup:** Supabase Free = daily backups; **Pro = Point-in-Time Recovery (PITR)** —
      irekomenda para sa production (may pera). Weekly manual export din
      (Dashboard → Database → Backups, o `pg_dump`).
- [ ] **Monitoring:** Supabase → Reports (API, DB, Auth). Netlify → Deploys/Analytics.
- [ ] **(Opsyonal) Error tracking:** magdagdag ng Sentry sa client para sa runtime errors.

---

## 7. Pilot bago i-full launch

- [ ] **20 households × 1 buong cycle** — parallel run kasama ang manwal na tala.
- [ ] I-verify: reading → bill → bayad → confirm → **balanse tama**.
- [ ] I-tsek ang **collection report** vs manwal na tala ng treasurer (dapat ₱0 variance).
- [ ] Kolektahin ang feedback; ayusin ang bug bago i-full rollout.

---

## 8. Rollback plan

- Ang code ay naka-version sa GitHub — puwedeng i-revert ang deploy sa Netlify
  (Deploys → piliin ang lumang deploy → **Publish deploy**).
- Ang database ay may backups (#6) — i-restore kung kinakailangan.
- Dahil idempotent ang migrations, ligtas ulitin kung may pumalpak.

---

## Quick reference — mga role

| Role | Nakikita / Kaya |
|---|---|
| **Homeowner** | Sariling bill, konsumo, bayad (submit + proof), concern, profile |
| **Staff** | Reading (+photo), properties (read-only), endorse ng bayad, sagot sa concern — **HINDI** hawak ang account, **HINDI** makapag-confirm ng bayad |
| **Admin** | Lahat — accounts, rates, cycles, **confirm ng bayad**, reports, audit |

*Ang seguridad ay ipinatutupad sa **Row Level Security** (database), hindi sa UI lang.*
