// =====================================================================
//  SCS BILLING — Edge Function: send-push
//  Nagpapadala ng Web Push notification sa mga naka-subscribe na device.
//
//  Seguridad: dalawang paraan lang para tumawag —
//    1) Admin/staff JWT (Authorization: Bearer <access_token>)
//    2) Internal secret header (x-internal-secret: <PUSH_INTERNAL_SECRET>)
//       — para sa server-to-server (DB webhook / ibang Edge Function).
//
//  Kailangang env (Supabase → Edge Functions → Secrets):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...),
//    PUSH_INTERNAL_SECRET (opsyonal), at auto: SUPABASE_URL,
//    SUPABASE_SERVICE_ROLE_KEY.
//
//  Body (JSON):
//    { title, body, url?, tag?,
//      user_id? | user_ids?[] | role? }   ← pumili ng target; kung wala,
//                                            ipapadala sa lahat.
// =====================================================================
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-internal-secret, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
  const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
  const INTERNAL_SECRET = Deno.env.get('PUSH_INTERNAL_SECRET')

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: 'vapid-not-configured' }, 500)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  })

  // ---- Authorize ---------------------------------------------------
  const secretHeader = req.headers.get('x-internal-secret')
  const isInternal = Boolean(INTERNAL_SECRET) && secretHeader === INTERNAL_SECRET

  if (!isInternal) {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401)

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      return json({ error: 'forbidden' }, 403)
    }
  }

  // ---- Parse body --------------------------------------------------
  let payload: {
    title?: string
    body?: string
    url?: string
    tag?: string
    user_id?: string
    user_ids?: string[]
    role?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid-json' }, 400)
  }

  const { title, body, url, tag, user_id, user_ids, role } = payload
  if (!title) return json({ error: 'title-required' }, 400)

  // ---- Resolve target subscriptions --------------------------------
  let query = admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id')

  if (user_id) {
    query = query.eq('user_id', user_id)
  } else if (user_ids && user_ids.length) {
    query = query.in('user_id', user_ids)
  } else if (role) {
    const { data: ids } = await admin.from('profiles').select('id').eq('role', role)
    const list = (ids ?? []).map((r) => r.id)
    if (!list.length) return json({ sent: 0, failed: 0, note: 'no-users-for-role' })
    query = query.in('user_id', list)
  }

  const { data: subs, error: subErr } = await query
  if (subErr) return json({ error: 'db-error', detail: subErr.message }, 500)
  if (!subs || !subs.length) return json({ sent: 0, failed: 0, note: 'no-subscriptions' })

  // ---- Send --------------------------------------------------------
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  const notification = JSON.stringify({
    title,
    body: body ?? '',
    url: url ?? '/',
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  })

  let sent = 0
  let failed = 0
  const deadIds: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notification,
        )
        sent++
      } catch (err) {
        failed++
        const code = (err as { statusCode?: number }).statusCode
        // 404/410 = patay na ang subscription → i-prune.
        if (code === 404 || code === 410) deadIds.push(s.id)
      }
    }),
  )

  if (deadIds.length) {
    await admin.from('push_subscriptions').delete().in('id', deadIds)
  }

  return json({ sent, failed, pruned: deadIds.length })
})
