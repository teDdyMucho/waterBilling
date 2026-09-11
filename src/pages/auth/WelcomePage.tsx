import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Mail,
  MessageSquare,
  Receipt,
} from 'lucide-react'
import { fetchWelcomeInfo } from '@/features/auth/auth-api'
import { LogoMark } from '@/components/Logo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Card, CardBody } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'

/** Ang default na password mula sa create_property_with_account (0029). */
const DEFAULT_PASSWORD = '123456'

/**
 * Ang pahinang binubuksan ng homeowner mula sa link na ibinigay ng staff
 * (/welcome/:token). Pampubliko — hindi kailangang naka-login.
 *
 * Ipinapaliwanag nito ang sistema, ang mga hakbang, at ang mga ilalagay
 * niya; saka lang siya dadalhin sa login (naka-prefill na ang email).
 */
export default function WelcomePage() {
  const { t } = useT()
  const { token = '' } = useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['welcome', token],
    queryFn: () => fetchWelcomeInfo(token),
    enabled: token.length > 0,
    retry: false,
  })

  const features = [
    { icon: Receipt, title: t('welcome.feat1Title'), desc: t('welcome.feat1Desc') },
    { icon: Camera, title: t('welcome.feat2Title'), desc: t('welcome.feat2Desc') },
    { icon: CreditCard, title: t('welcome.feat3Title'), desc: t('welcome.feat3Desc') },
    { icon: MessageSquare, title: t('welcome.feat4Title'), desc: t('welcome.feat4Desc') },
  ]
  const steps = [t('welcome.step1'), t('welcome.step2'), t('welcome.step3'), t('welcome.step4')]
  const prepare = [t('welcome.prep1'), t('welcome.prep2'), t('welcome.prep3')]

  const loginHref = data?.email ? `/login?email=${encodeURIComponent(data.email)}` : '/login'

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{t('app.name')}</p>
              <p className="text-xs text-slate-500">{t('app.subdivision')}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
        {isLoading && <PageLoader />}

        {!isLoading && (isError || !data) && (
          <Card>
            <CardBody className="space-y-4 text-center sm:p-8">
              <h1 className="text-xl font-bold text-slate-900">{t('welcome.invalidTitle')}</h1>
              <p className="text-sm text-slate-600">{t('welcome.invalidSub')}</p>
              <Link to="/login" className="inline-block">
                <Button variant="outline">{t('welcome.goLogin')}</Button>
              </Link>
            </CardBody>
          </Card>
        )}

        {data && (
          <>
            {/* ---------------- Pagbati ---------------- */}
            <section className="relative overflow-hidden rounded-card bg-brand-900 p-6 text-white sm:p-8">
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]" />
                <div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/[0.05] blur-3xl" />
              </div>
              <div className="relative">
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-50 ring-1 ring-inset ring-white/15">
                  {t('welcome.forLot', { lot: lotLabel(data.block, data.lot) })}
                </span>
                <h1 className="display mt-4 text-2xl font-bold text-white sm:text-3xl">{t('welcome.title')}</h1>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-brand-100/90">
                  {t('welcome.sub')}
                </p>
              </div>
            </section>

            {/* ---------------- Ano ito ---------------- */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">{t('welcome.aboutTitle')}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {features.map(({ icon: Icon, title, desc }) => (
                    <li key={title} className="flex gap-3 rounded-input border border-slate-200 bg-slate-50/60 p-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-inset ring-slate-200">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            {/* ---------------- Mga hakbang ---------------- */}
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">{t('welcome.stepsTitle')}</h2>
                <ol className="space-y-3">
                  {steps.map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <p className="pt-1 text-sm leading-relaxed text-slate-700">{s}</p>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>

            {/* ---------------- Ihanda ---------------- */}
            <Card>
              <CardBody className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">{t('welcome.prepareTitle')}</h2>
                <ul className="space-y-2">
                  {prepare.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-700" />
                      {p}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            {/* ---------------- Account ---------------- */}
            <Card className="border-brand-200">
              <CardBody className="space-y-4">
                {data.setup_done ? (
                  <>
                    <h2 className="text-base font-bold text-slate-900">{t('welcome.alreadyTitle')}</h2>
                    <p className="text-sm text-slate-600">{t('welcome.alreadySub')}</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-base font-bold text-slate-900">{t('welcome.accountTitle')}</h2>
                    <p className="text-sm text-slate-600">{t('welcome.accountNote')}</p>

                    <CredentialRow
                      icon={<Mail className="size-4" />}
                      label={t('auth.email')}
                      value={data.email ?? ''}
                    />
                    <CredentialRow
                      icon={<KeyRound className="size-4" />}
                      label={t('auth.password')}
                      value={DEFAULT_PASSWORD}
                    />
                  </>
                )}

                <Link to={loginHref} className="block">
                  <Button block size="lg" iconRight={<ArrowRight className="size-4" />}>
                    {t('welcome.loginNow')}
                  </Button>
                </Link>
              </CardBody>
            </Card>

            <p className="pb-6 text-center text-xs text-slate-500">{t('welcome.help')}</p>
          </>
        )}
      </main>
    </div>
  )
}

function CredentialRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-input border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
          <span className="text-slate-400">{icon}</span>
          <span className="truncate font-medium">{value}</span>
        </div>
        <CopyButton text={value} />
      </div>
    </div>
  )
}
