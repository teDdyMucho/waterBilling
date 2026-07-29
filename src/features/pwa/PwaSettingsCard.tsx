import { Bell, BellOff, Check, Download, Share, Smartphone } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useT } from '@/hooks/useT'
import { usePwaInstall } from './usePwaInstall'
import { usePush } from './usePush'

/**
 * Card para sa profile: pag-install ng app + pag-on/off ng push notifications.
 * Ipinapakita ang bawat kontrol ayon sa suporta ng device/browser.
 */
export function PwaSettingsCard() {
  const { t } = useT()
  const { canInstall, isStandalone, needsIOSInstructions, promptInstall } = usePwaInstall()
  const push = usePush()

  return (
    <Card>
      <CardHeader title={t('pwa.appCardTitle')} description={t('pwa.appCardSub')} />
      <CardBody className="space-y-5">
        {/* ---- Install ---- */}
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-card bg-slate-100 text-slate-600">
            <Smartphone className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{t('pwa.installRowTitle')}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {isStandalone
                ? t('pwa.installedNote')
                : needsIOSInstructions
                  ? t('pwa.iosInline')
                  : t('pwa.installRowSub')}
            </p>
          </div>
          {isStandalone ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              <Check className="size-3.5" /> {t('pwa.installed')}
            </span>
          ) : canInstall ? (
            <Button size="sm" iconLeft={<Download className="size-4" />} onClick={() => promptInstall()}>
              {t('pwa.install')}
            </Button>
          ) : needsIOSInstructions ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
              <Share className="size-4" />
            </span>
          ) : null}
        </div>

        <div className="h-px bg-slate-100" />

        {/* ---- Notifications ---- */}
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-card bg-slate-100 text-slate-600">
            {push.subscribed ? <Bell className="size-5" /> : <BellOff className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{t('pwa.notifTitle')}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {push.status === 'unsupported'
                ? t('pwa.notifUnsupported')
                : push.status === 'not-configured'
                  ? t('pwa.notifNotConfigured')
                  : push.status === 'denied'
                    ? t('pwa.notifDenied')
                    : push.subscribed
                      ? t('pwa.notifOnNote')
                      : t('pwa.notifSub')}
            </p>
            {push.error && push.error !== 'denied' && (
              <p className="mt-1 text-xs text-slate-400">{t('pwa.notifError')}</p>
            )}
          </div>

          {(push.status === 'default' || push.status === 'granted') && (
            <div className="shrink-0">
              {push.subscribed ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={push.busy}
                  onClick={() => push.disable()}
                >
                  {t('pwa.turnOff')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  iconLeft={<Bell className="size-4" />}
                  loading={push.busy}
                  onClick={() => push.enable()}
                >
                  {t('pwa.turnOn')}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
