# SCS Billing Portal

Water & electricity billing system para sa **Santa Cicilia Subdivision**.

| | |
|---|---|
| **Frontend** | React 19 · Vite 7 · TypeScript · **Tailwind CSS v4** |
| **Backend** | Supabase (Postgres · Auth · Storage · Realtime · RLS) |
| **Hosting** | Netlify |
| **Wika** | English + Tagalog (EN/TL toggle) |

📄 [PRD](docs/PRD.md) — ano at bakit · 📄 [PHASES](docs/PHASES.md) — paano at kailan

---

## Pagsisimula / Getting started

```bash
npm install
cp .env.example .env.local   # punan ang Supabase URL at ANON key
npm run dev                  # http://localhost:5173
```

| Command | Ginagawa |
|---|---|
| `npm run dev` | Dev server (mabilis, may hot reload) |
| `npm run build` | Type-check (`tsc -b`) + production build sa `dist/` |
| `npm run preview` | Subukan ang production build nang lokal |
| `npm run lint` | Type-check lang |

---

## Deploy sa Netlify

1. I-push ang repo sa GitHub.
2. Netlify → **Add new site** → **Import an existing project**.
3. Build command `npm run build`, publish directory `dist` (naka-set na sa `netlify.toml`).
4. Site settings → **Environment variables**, ilagay ang:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_NAME`
5. Deploy. Ang SPA redirect ay nasa `netlify.toml` na, kaya hindi mag-4o4 ang `/login` kapag ni-refresh.

---

## Istruktura

```
src/
  app/          App.tsx — router at providers
  components/
    ui/         Button · Card · Badge · Input (design system)
    Logo.tsx    LanguageToggle.tsx
  features/
    landing/    LandingHeader · BillPreview
  hooks/        useT (i18n)
  i18n/         I18nProvider
  lib/          cn · format (pera, m³, kWh, petsa) · supabase
  locales/      en.json · tl.json
  pages/        LandingPage · AuthPlaceholder · NotFoundPage
docs/           PRD.md · PHASES.md
```

---

## Mahahalagang panuntunan

1. **Mobile-first.** Bawat screen ay sinusubukan sa **360px** bago sa desktop. Karamihan ng residente ay cellphone ang gamit.
2. **Anon key lang sa client.** Ang `service_role` key ay hindi kailanman papasok sa `src/` — Edge Function lang ang puwedeng humawak nito.
3. **RLS ang seguridad.** Ang UI ay convenience lang. Bawat bagong table ay may policy agad.
4. **Pera = integer centavos** sa lahat ng lohika. `peso()` lang ang nagfo-format sa display. Iwas sa floating-point error.
5. **Bilingual habang ginagawa.** Bawat bagong string ay pumapasok agad sa `en.json` **at** `tl.json`.
6. **Base font 16px.** Marami ang senior citizen na gagamit; iniiwasan din nito ang auto-zoom ng iOS sa input.

---

## Progreso

- [x] **Phase 0** — Foundation, design system, landing page, Netlify config
- [x] **Phase 1** — Auth & role routing (Supabase) — register, login, pending gate, admin approvals, RLS
- [ ] **Phase 2** — Master data (properties, meters, users)
- [ ] **Phase 3** — Meter reading + required photo
- [ ] **Phase 4** — Billing engine
- [ ] **Phase 5** — Homeowner portal
- [ ] **Phase 6** — Messaging & notifications
- [ ] **Phase 7** — 💰 Payment (submit → endorse → confirm)
- [ ] **Phase 8** — Reports, audit, launch
