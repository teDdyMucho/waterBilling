/// <reference lib="webworker" />
//
// SCS Billing Portal — Custom Service Worker (injectManifest)
// -----------------------------------------------------------------------------
// Isang SW na gumagawa ng lahat:
//   1) Offline app-shell (precache ng build assets + SPA navigation fallback)
//   2) Runtime caching (fonts, Supabase reads, storage images)
//   3) Web Push notifications (push + notificationclick)
//   4) Update flow (SKIP_WAITING message mula sa UI)
//
// Bina-build ito ng vite-plugin-pwa (hiwalay sa app na `tsc -b`), kaya
// naka-exclude ito sa tsconfig.json.
//
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope & typeof globalThis

// -----------------------------------------------------------------------------
// 1) Precache — inilalagay ni vite-plugin-pwa ang build manifest sa __WB_MANIFEST
// -----------------------------------------------------------------------------
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback: lahat ng in-app route → i-serve ang precached index.html
// kapag offline, para gumana ang buong app kahit walang signal.
const navigationHandler = createHandlerBoundToURL('index.html')
registerRoute(
  new NavigationRoute(navigationHandler, {
    // Huwag saluhin ang mga hindi-app na path (wala tayong /api, pero ligtas na ito).
    denylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
  }),
)

// -----------------------------------------------------------------------------
// 2) Runtime caching
// -----------------------------------------------------------------------------

// Google Fonts stylesheet — laging sariwa kung online, gamit cache kung offline.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
)

// Google Fonts webfont files — matagal bago magbago, cache-first + 1 taon.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365, purgeOnQuotaError: true }),
    ],
  }),
)

// Supabase REST reads (GET lang) — NetworkFirst para laging bago kapag online,
// pero may last-seen fallback kapag offline. Hindi kasama ang /auth (sensitibo).
registerRoute(
  ({ url, request }) =>
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/rest/v1') &&
    request.method === 'GET',
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24, purgeOnQuotaError: true }),
    ],
  }),
)

// Supabase Storage images (avatars, resibo) — cache-first, madaling i-cache.
registerRoute(
  ({ url, request }) =>
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.includes('/storage/v1/object') &&
    request.destination === 'image',
  new CacheFirst({
    cacheName: 'supabase-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true }),
    ],
  }),
)

// Iba pang same-origin images (icons, illustrations) — SWR.
registerRoute(
  ({ request, url }) => request.destination === 'image' && url.origin === self.location.origin,
  new StaleWhileRevalidate({
    cacheName: 'local-images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// -----------------------------------------------------------------------------
// 3) Web Push
// -----------------------------------------------------------------------------
type PushPayload = {
  title?: string
  body?: string
  url?: string
  tag?: string
  icon?: string
  badge?: string
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {}
  try {
    data = event.data ? (event.data.json() as PushPayload) : {}
  } catch {
    data = { body: event.data?.text() }
  }

  const title = data.title || 'SCS Billing'
  const options: NotificationOptions = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // May bukas na tab? I-focus at i-navigate.
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client && targetUrl) {
            try {
              await client.navigate(targetUrl)
            } catch {
              /* ignore cross-origin navigate errors */
            }
          }
          return
        }
      }
      // Wala — magbukas ng bagong window.
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl)
    })(),
  )
})

// -----------------------------------------------------------------------------
// 4) Update flow — i-apply agad ang bagong SW kapag pinindot ng user ang "Update"
// -----------------------------------------------------------------------------
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
