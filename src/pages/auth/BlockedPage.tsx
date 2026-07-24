import { LogOut, Phone, ShieldX } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'

export default function BlockedPage() {
  const { t } = useT()
  const { profile, signOut } = useAuth()

  const isRejected = profile?.status === 'rejected'
  const message = isRejected ? t('auth.blockedRejected') : t('auth.blockedSuspended')

  return (
    <div className="relative grid min-h-dvh grid-rows-[auto_1fr] overflow-hidden bg-slate-50">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid mask-fade-b absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 -top-32 h-80 bg-[radial-gradient(42rem_22rem_at_50%_0%,var(--color-danger-100),transparent_70%)]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <LogoMark className="size-9" />
        <LanguageToggle />
      </header>

      <main className="relative z-10 flex items-start justify-center px-4 pb-12 pt-2 sm:items-center">
        <div className="w-full max-w-md">
          <div className="rounded-card border border-slate-200 bg-white p-6 shadow-raised sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-full bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-100">
                <ShieldX className="size-7" />
              </span>
              <h1 className="mt-5 text-xl font-bold text-slate-900">{t('auth.blockedTitle')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
            </div>

            {isRejected && profile?.rejection_reason && (
              <Alert tone="danger" title={t('auth.reasonLabel')} className="mt-5">
                {profile.rejection_reason}
              </Alert>
            )}

            <div className="mt-6 flex items-center gap-2.5 rounded-input bg-slate-50 p-4 text-sm text-slate-600">
              <Phone className="size-4 shrink-0 text-slate-400" />
              <span>{t('auth.contactOffice')}: 0900 000 0000</span>
            </div>

            <Button
              variant="outline"
              block
              className="mt-6"
              iconLeft={<LogOut className="size-4" />}
              onClick={() => signOut()}
            >
              {t('common.signOut')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
