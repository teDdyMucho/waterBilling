import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, User } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { completeHomeownerSetup } from '@/features/properties/properties-api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'
import { ROLE_HOME } from '@/types/domain'

/**
 * Unang login ng bagong homeowner. Ang account ay ginawa ng staff kasabay
 * ng property, kaya walang pangalan at address pa — dito niya ito ilalagay.
 * Hindi siya makakapasok sa dashboard hangga't hindi ito natatapos.
 */
export default function SetupPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()

  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError(t('common.required'))

    setBusy(true)
    try {
      await completeHomeownerSetup(fullName, address)
      await refreshProfile()
      navigate(ROLE_HOME.homeowner, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.somethingWrong'))
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh grid-rows-[auto_1fr] overflow-hidden bg-slate-50">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid mask-fade-b absolute inset-0 opacity-60" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <LogoMark className="size-9" />
        <LanguageToggle />
      </header>

      <main className="relative z-10 flex items-start justify-center px-4 pb-12 pt-2 sm:items-center">
        <div className="w-full max-w-md">
          <div className="rounded-card border border-slate-200 bg-white p-6 shadow-raised sm:p-8">
            <h1 className="text-xl font-bold text-slate-900">{t('setup.title')}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t('setup.sub')}</p>

            {(profile?.block || profile?.lot) && (
              <p className="mt-3 rounded-input bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {lotLabel(profile.block, profile.lot)}
              </p>
            )}

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}

              <Input
                label={`${t('auth.fullName')} *`}
                placeholder={t('auth.fullNamePh')}
                iconLeft={<User className="size-4" />}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
              <Input
                label={t('setup.address')}
                placeholder={t('setup.addressPh')}
                iconLeft={<Home className="size-4" />}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              <Button type="submit" block size="lg" loading={busy}>
                {t('setup.save')}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
