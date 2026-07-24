import { Clock, LogOut, ShieldCheck } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'

export default function PendingPage() {
  const { t } = useT()
  const { profile, signOut } = useAuth()

  return (
    <div className="relative grid min-h-dvh grid-rows-[auto_1fr] overflow-hidden bg-slate-50">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid mask-fade-b absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 -top-32 h-80 bg-[radial-gradient(42rem_22rem_at_50%_0%,var(--color-warning-100),transparent_70%)]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <LogoMark className="size-9" />
        <LanguageToggle />
      </header>

      <main className="relative z-10 flex items-start justify-center px-4 pb-12 pt-2 sm:items-center">
        <div className="w-full max-w-md">
          <div className="rounded-card border border-slate-200 bg-white p-6 shadow-raised sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-full bg-warning-50 text-warning-600 ring-1 ring-inset ring-warning-100">
                <Clock className="size-7" />
              </span>
              <h1 className="mt-5 text-xl font-bold text-slate-900">{t('auth.pendingTitle')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t('auth.pendingBody')}
              </p>
            </div>

            {profile && (
              <div className="mt-6 space-y-2 rounded-input bg-slate-50 p-4 text-sm">
                <Row label={t('auth.fullName')} value={profile.full_name} />
                <Row label={t('auth.email')} value={profile.email ?? '—'} />
                <Row label="Block / Lot" value={lotLabel(profile.block, profile.lot)} />
              </div>
            )}

            <Alert tone="info" className="mt-5">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 shrink-0" />
                {t('auth.pendingHint')}
              </span>
            </Alert>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 truncate font-medium text-slate-900">{value}</span>
    </div>
  )
}
