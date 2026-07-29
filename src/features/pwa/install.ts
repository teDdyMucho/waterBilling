//
// Install-prompt capture
// -----------------------------------------------------------------------------
// Ang `beforeinstallprompt` ay pwedeng pumutok BAGO pa mag-mount ang React,
// kaya sinasalo natin ito nang maaga (via initInstallCapture sa main.tsx) at
// itinatago sa module-level singleton. Nagsu-subscribe ang UI dito.
//
let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Tawagin ISANG BESES, maaga (main.tsx), bago mag-render. */
export function initInstallCapture() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    // Pigilan ang default mini-infobar — sarili nating banner ang gagamitin.
    e.preventDefault()
    deferredPrompt = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    try {
      localStorage.removeItem(INSTALL_DISMISS_KEY)
    } catch {
      /* ignore */
    }
    emit()
  })
}

export function subscribeInstall(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function canInstall() {
  return deferredPrompt !== null
}

export function isInstalled() {
  return installed
}

/** Ipakita ang native na install prompt. Ibinabalik ang desisyon ng user. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  const evt = deferredPrompt
  await evt.prompt()
  const choice = await evt.userChoice
  deferredPrompt = null
  emit()
  return choice.outcome
}

// ---- Environment helpers ----------------------------------------------------

/** Naka-install na ba (tumatakbo bilang standalone app, walang browser bar)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iOS/iPadOS ba? (Walang beforeinstallprompt — kailangan ng manual na hakbang.) */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOSDevice = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ ay nagpapanggap na Mac — hulihin via touch points.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return iOSDevice || iPadOS
}

// ---- Banner dismissal (persisted) -------------------------------------------

const INSTALL_DISMISS_KEY = 'scs-install-dismissed'
const REPROMPT_AFTER_MS = 1000 * 60 * 60 * 24 * 7 // 7 araw

export function isInstallDismissed(): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < REPROMPT_AFTER_MS
  } catch {
    return false
  }
}

export function dismissInstall() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
  emit()
}
