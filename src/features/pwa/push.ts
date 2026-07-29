//
// Web Push — client helpers
// -----------------------------------------------------------------------------
// Nagsu-subscribe sa push, at itinatago ang subscription sa Supabase table
// `push_subscriptions` (tingnan ang migration 0012). Ang aktuwal na pagpapadala
// ng notification ay ginagawa ng Edge Function `send-push` (server-side, VAPID).
//
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** Naka-configure ba ang push? (May VAPID public key at may browser support.) */
export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY)
}

/** Sinusuportahan ba ng browser ang push? */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

// base64url (VAPID) → Uint8Array (kailangan ng applicationServerKey).
// Tahasang ArrayBuffer-backed para tumugma sa BufferSource (TS 5.7+ typed arrays).
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready)
}

/** Kasalukuyang subscription (kung meron). */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/**
 * Humingi ng permission, mag-subscribe, at i-save sa Supabase.
 * Ibinabalik ang subscription, o nagta-throw ng may-dahilang error.
 */
export async function enablePush(): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('unsupported')
  if (!VAPID_PUBLIC_KEY) throw new Error('not-configured')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')

  const reg = await getRegistration()
  if (!reg) throw new Error('no-sw')

  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  await saveSubscription(sub)
  return sub
}

/** Mag-unsubscribe at burahin sa Supabase. */
export async function disablePush(): Promise<void> {
  const sub = await getExistingSubscription()
  if (!sub) return
  await deleteSubscription(sub.endpoint)
  try {
    await sub.unsubscribe()
  } catch {
    /* ignore */
  }
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? bufferToBase64Url(sub.getKey('p256dh')),
      auth: json.keys?.auth ?? bufferToBase64Url(sub.getKey('auth')),
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

async function deleteSubscription(endpoint: string): Promise<void> {
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
