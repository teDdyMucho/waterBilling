import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Camera, CreditCard, Languages, ShieldCheck } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useT } from '@/hooks/useT'

/**
 * Split-screen na balangkas ng login / register / forgot / reset.
 *  - Desktop: branding panel sa kaliwa, form sa kanan.
 *  - Mobile: form lang (naka-full width), may compact na logo sa itaas.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { t } = useT()

  const points = [
    { icon: Camera, text: t('landing.trust1') },
    { icon: ShieldCheck, text: t('landing.trust2') },
    { icon: Languages, text: t('landing.trust3') },
  ]
  const chips = [t('common.water'), t('common.electricity'), 'GCash', 'Maya', 'Bank']

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      {/* ===================== LEFT — branding ===================== */}
      <aside className="relative hidden overflow-hidden bg-brand-900 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:p-12">
        {/* Dekorasyon — subtle na monochrome texture */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute -left-20 top-16 size-72 rounded-full bg-white/[0.04] blur-3xl" />
          <div className="absolute -right-16 bottom-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <span className="grid place-items-center rounded-xl bg-white/10 p-1.5 ring-1 ring-inset ring-white/20 backdrop-blur">
            <LogoMark className="size-9" />
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-white">{t('app.subdivision')}</p>
            <p className="text-sm text-brand-100/80">{t('app.tagline')}</p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-200/90">
            {t('landing.badge')}
          </p>
          <h2 className="display text-3xl font-bold text-white xl:text-4xl">
            {t('auth.brandHeadline')}
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-brand-100/85">
            {t('auth.brandDesc')}
          </p>

          <ul className="mt-7 space-y-2.5">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-brand-50/90">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Chips */}
        <div className="relative">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-200/70">
            {t('auth.brandTagline')}
          </p>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-50 ring-1 ring-inset ring-white/15 backdrop-blur"
              >
                <CreditCard className="size-3 opacity-60" />
                {c}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* ===================== RIGHT — form ===================== */}
      <div className="relative flex min-h-dvh flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{t('common.backToHome')}</span>
            <span className="sm:hidden">{t('app.name')}</span>
          </Link>
          <LanguageToggle />
        </header>

        {/* Form */}
        <main className="flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-6">
          <div className="w-full max-w-sm">
            {/* Mobile logo (nakatago sa desktop dahil nasa left panel na) */}
            <div className="mb-7 flex flex-col items-center text-center lg:items-start lg:text-left">
              <LogoMark className="size-11 lg:hidden" />
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 lg:mt-0">
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>}
            </div>

            {children}

            {footer && (
              <div className="mt-6 text-center text-sm text-slate-600 lg:text-left">
                {footer}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
