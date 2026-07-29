import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { CheckCircle2, RefreshCw, X } from 'lucide-react'
import { useT } from '@/hooks/useT'
import { InstallBanner } from './InstallBanner'

/**
 * Sentral na PWA controller — nire-register ang service worker at nagpapakita ng:
 *   • Update toast (may bagong bersyon → "I-update")
 *   • Offline-ready toast (handa nang gamitin offline)
 *   • Install banner (custom "Add to Home Screen")
 *
 * Naka-mount ito nang isang beses sa App, kaya app-wide ang epekto.
 */
export function PwaManager() {
  const { t } = useT()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      // Huwag ipa-crash ang app kung pumalya ang SW registration.
      console.error('SW registration error', err)
    },
  })

  // Awto-itago ang offline-ready toast pagkalipas ng ilang segundo.
  useEffect(() => {
    if (!offlineReady) return
    const id = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(id)
  }, [offlineReady, setOfflineReady])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4">
      {/* Offline-ready */}
      {offlineReady && (
        <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border border-slate-200 bg-white p-3.5 shadow-overlay animate-in">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50">
            <CheckCircle2 className="size-5 text-brand-700" />
          </span>
          <p className="flex-1 text-sm font-medium text-slate-700">{t('pwa.offlineReady')}</p>
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            aria-label={t('common.close')}
            className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Update available */}
      {needRefresh && (
        <div className="pointer-events-auto w-full max-w-sm rounded-card border border-slate-200 bg-white p-4 shadow-overlay animate-in">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50">
              <RefreshCw className="size-5 text-brand-700" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t('pwa.updateTitle')}</p>
              <p className="mt-0.5 text-sm text-slate-600">{t('pwa.updateBody')}</p>
            </div>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              aria-label={t('common.close')}
              className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="inline-flex h-9 items-center rounded-input px-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t('pwa.later')}
            </button>
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-input bg-brand-700 px-3.5 text-sm font-semibold text-white shadow-brand ring-1 ring-inset ring-white/10 hover:bg-brand-600 active:bg-brand-800"
            >
              <RefreshCw className="size-4" />
              {t('pwa.updateNow')}
            </button>
          </div>
        </div>
      )}

      {/* Install (Add to Home Screen) */}
      <InstallBanner />
    </div>
  )
}
