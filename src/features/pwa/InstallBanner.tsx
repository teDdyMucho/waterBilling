import { useState } from 'react'
import { Download, Plus, Share, X } from 'lucide-react'
import { useT } from '@/hooks/useT'
import { LogoMark } from '@/components/Logo'
import { usePwaInstall } from './usePwaInstall'

/**
 * Custom na "Add to Home Screen" banner.
 *   • Android / desktop Chrome/Edge → tunay na install button (beforeinstallprompt)
 *   • iOS Safari → instruksyon (Share → Add to Home Screen), walang auto-prompt
 * Naka-render lang ito sa loob ng PwaManager (fixed bottom container).
 */
export function InstallBanner() {
  const { t } = useT()
  const { canInstall, isStandalone, needsIOSInstructions, dismissed, promptInstall, dismiss } =
    usePwaInstall()
  const [showIOS, setShowIOS] = useState(false)

  // Wala nang dapat ipakita kung naka-install na o na-dismiss na.
  if (isStandalone || dismissed) return null
  if (!canInstall && !needsIOSInstructions) return null

  const handleInstall = async () => {
    if (canInstall) {
      const outcome = await promptInstall()
      if (outcome === 'dismissed') dismiss()
    } else if (needsIOSInstructions) {
      setShowIOS((v) => !v)
    }
  }

  return (
    <div className="pointer-events-auto w-full max-w-sm rounded-card border border-slate-200 bg-white p-4 shadow-overlay animate-in">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-card bg-brand-50">
          <LogoMark className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t('pwa.installTitle')}</p>
          <p className="mt-0.5 text-sm text-slate-600">{t('pwa.installBody')}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('common.close')}
          className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* iOS: hakbang-hakbang na instruksyon */}
      {needsIOSInstructions && showIOS && (
        <div className="mt-3 space-y-2 rounded-input bg-slate-50 p-3 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-700 ring-1 ring-slate-200">
              1
            </span>
            {t('pwa.iosStep1')}
            <Share className="size-4 shrink-0 text-brand-700" />
          </p>
          <p className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-700 ring-1 ring-slate-200">
              2
            </span>
            {t('pwa.iosStep2')}
            <Plus className="size-4 shrink-0 text-brand-700" />
          </p>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-9 items-center rounded-input px-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          {t('pwa.notNow')}
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="inline-flex h-9 items-center gap-1.5 rounded-input bg-brand-700 px-3.5 text-sm font-semibold text-white shadow-brand ring-1 ring-inset ring-white/10 hover:bg-brand-600 active:bg-brand-800"
        >
          {canInstall ? <Download className="size-4" /> : <Share className="size-4" />}
          {canInstall ? t('pwa.install') : t('pwa.howToInstall')}
        </button>
      </div>
    </div>
  )
}
