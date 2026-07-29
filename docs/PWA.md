# PWA — SCS Billing Portal

Ang portal ay isa nang **Progressive Web App**: pwedeng i-install sa home screen,
gumagana offline (app shell + huling na-load na datos), may custom install prompt,
at may **push notifications**.

## Ano ang kasama

| Feature | Saan naka-code | Kailangan pa ba i-setup? |
|---|---|---|
| Installable + app icons | `vite.config.ts` (manifest), `public/icons/*` | Hindi — ready na |
| Offline caching | `src/sw.ts` (Workbox precache + runtime caching) | Hindi — ready na |
| Update prompt (bagong bersyon) | `src/features/pwa/PwaManager.tsx` | Hindi |
| Custom install banner (+ iOS) | `src/features/pwa/InstallBanner.tsx` | Hindi |
| Push notifications | `src/features/pwa/{push,usePush}.ts`, Edge Function `send-push` | **Oo** — tingnan sa baba |

> **Mahalaga:** Ang service worker ay gumagana lang sa **production build** (o `https`
> / `localhost`). Sa `npm run dev` naka-off ito by default (tingnan `devOptions.enabled`
> sa `vite.config.ts`). Para subukan nang lokal:
>
> ```bash
> npm run build && npm run preview
> ```
>
> Buksan ang `http://localhost:4173` → DevTools → Application → Service Workers / Manifest.

## Icons

Naka-generate na sa `public/icons/` (192, 512, maskable-512, apple-touch 180, badge 72)
mula sa `public/favicon.svg`. Kung papalitan ang brand mark, i-regenerate lang ang mga
PNG sa parehong sukat (o gamitin ang `@vite-pwa/assets-generator`).

---

## Push Notifications — Setup (3 hakbang)

### 1) Gumawa ng VAPID keys

```bash
npx web-push generate-vapid-keys
```

Ibibigay nito ang **Public Key** at **Private Key**.

- **Public key** → ilagay sa `.env.local` (at sa hosting env, hal. Netlify):

  ```
  VITE_VAPID_PUBLIC_KEY=BEl...your-public-key...
  ```

- **Private key** → **HUWAG** ilagay sa frontend. Sa Supabase secrets lang (susunod).

### 2) Database

Patakbuhin ang migration na gumagawa ng `push_subscriptions` table:

```bash
supabase db push
# o i-run ang supabase/migrations/0012_push_subscriptions.sql sa SQL editor
```

### 3) Edge Function

I-deploy ang `send-push` at ilagay ang mga secret:

```bash
supabase functions deploy send-push

supabase secrets set \
  VAPID_PUBLIC_KEY="BEl...public..." \
  VAPID_PRIVATE_KEY="...private..." \
  VAPID_SUBJECT="mailto:admin@santacicilia.example" \
  PUSH_INTERNAL_SECRET="$(openssl rand -hex 24)"
```

> `SUPABASE_URL` at `SUPABASE_SERVICE_ROLE_KEY` ay awtomatikong naka-inject sa Edge Functions.

---

## Paano magpadala ng notification

Ang `send-push` ay protektado — **admin/staff JWT** o **internal secret** lang.

**Payload:**

```jsonc
{
  "title": "Bago kang bill",          // required
  "body": "Ang Enero bill mo: ₱1,913.36",
  "url": "/dashboard/bills",          // bubuksan pag na-click
  "tag": "bill-2026-01",              // (opsyonal) para hindi mag-doble
  // Pumili ng target — kung wala, LAHAT:
  "user_id": "uuid-ng-isang-user",
  "user_ids": ["uuid-1", "uuid-2"],
  "role": "homeowner"                 // "homeowner" | "staff" | "admin"
}
```

**Halimbawa (server-to-server, gamit internal secret):**

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/send-push" \
  -H "x-internal-secret: <PUSH_INTERNAL_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"role":"homeowner","title":"Bagong bill","body":"Tingnan ang bill mo","url":"/dashboard/bills"}'
```

**Mula sa app (admin/staff na naka-login):**

```ts
await supabase.functions.invoke('send-push', {
  body: { user_id, title, body, url },
})
```

Ibabalik nito ang `{ sent, failed, pruned }`. Awtomatikong binubura (pruned) ang mga
patay na subscription (404/410).

### Susunod na hakbang (opsyonal)

Para awtomatikong tumunog ang notification kapag may pangyayari (hal. na-confirm ang
bayad o bagong bill), gumawa ng **Database Webhook / trigger** na tatawag sa `send-push`
gamit ang `PUSH_INTERNAL_SECRET`. Hindi pa ito naka-wire — desisyon kung aling event
ang dapat mag-notify.
