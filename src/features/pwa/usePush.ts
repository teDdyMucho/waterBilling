import { useCallback, useEffect, useState } from 'react'
import {
  disablePush,
  enablePush,
  getExistingSubscription,
  isPushConfigured,
  isPushSupported,
  notificationPermission,
} from './push'

export type PushStatus = 'unsupported' | 'not-configured' | 'default' | 'denied' | 'granted'

/** Estado + aksyon para sa push notifications (ginagamit sa profile toggle). */
export function usePush() {
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    notificationPermission(),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported = isPushSupported()
  const configured = isPushConfigured()

  useEffect(() => {
    let alive = true
    if (!supported) return
    getExistingSubscription()
      .then((sub) => alive && setSubscribed(Boolean(sub)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [supported])

  const status: PushStatus = !supported
    ? 'unsupported'
    : !configured
      ? 'not-configured'
      : permission === 'denied'
        ? 'denied'
        : permission === 'granted'
          ? 'granted'
          : 'default'

  const enable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await enablePush()
      setSubscribed(true)
      setPermission('granted')
    } catch (e) {
      const code = e instanceof Error ? e.message : 'error'
      setError(code)
      if (code === 'denied') setPermission('denied')
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await disablePush()
      setSubscribed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setBusy(false)
    }
  }, [])

  return { supported, configured, status, permission, subscribed, busy, error, enable, disable }
}
