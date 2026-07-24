import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Droplets,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Megaphone,
  Phone,
  Receipt,
  ShieldCheck,
  Languages,
} from 'lucide-react'
import { LandingHeader } from '@/features/landing/LandingHeader'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/Logo'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

export default function LandingPage() {
  const { t } = useT()

  return (
    <div className="min-h-dvh bg-white">
      <LandingHeader />
      <main>
        <Hero />
        <TrustBar />
        <Features />
        <HowItWorks />
        <Faq />
        <Contact />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  )

  /* ---------------------------------------------------------------- */

  function Hero() {
    const trust = [
      { icon: Camera, text: t('landing.trust1') },
      { icon: ShieldCheck, text: t('landing.trust2') },
      { icon: Languages, text: t('landing.trust3') },
    ]

    return (
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        {/* Pinong grid + gradient glow — banayad na lalim, hindi maingay */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-grid mask-fade-b absolute inset-0" />
          <div className="absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(50rem_28rem_at_50%_0%,var(--color-brand-100),transparent_70%)]" />
          <div className="absolute -left-24 top-24 size-72 rounded-full bg-water-100/40 blur-3xl" />
          <div className="absolute -right-20 top-32 size-72 rounded-full bg-power-100/40 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-semibold text-brand-800 shadow-xs backdrop-blur">
            <ShieldCheck className="size-3.5" />
            <span>{t('landing.badge')}</span>
          </span>

          <h1 className="display mt-6 text-[2.25rem] font-bold text-slate-900 sm:text-6xl">
            {t('landing.heroTitle')}{' '}
            <span className="text-gradient-brand">{t('landing.heroTitleAccent')}</span>
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            {t('landing.heroSub')}
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/register" className="sm:w-auto">
              <Button size="lg" block iconRight={<ArrowRight className="size-4" />}>
                {t('landing.ctaPrimary')}
              </Button>
            </Link>
            <Link to="/login" className="sm:w-auto">
              <Button size="lg" variant="outline" block>
                {t('landing.ctaSecondary')}
              </Button>
            </Link>
          </div>

          {/* Trust chips */}
          <ul className="mt-10 flex flex-col flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm text-slate-600 sm:flex-row">
            {trust.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-brand-700" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    )
  }

  function TrustBar() {
    const items = [
      {
        icon: Droplets,
        label: t('landing.statsLabel1'),
        value: t('landing.statsValue1'),
      },
      {
        icon: CreditCard,
        label: t('landing.statsLabel2'),
        value: t('landing.statsValue2'),
      },
      {
        icon: Clock,
        label: t('landing.statsLabel3'),
        value: t('landing.statsValue3'),
      },
    ]
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-slate-200 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          {items.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3.5 px-0 py-5 sm:px-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-0.5 text-[0.9375rem] font-semibold text-slate-900">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  function Features() {
    const features = [
      { icon: Receipt, title: t('landing.f1Title'), body: t('landing.f1Body') },
      { icon: BarChart3, title: t('landing.f2Title'), body: t('landing.f2Body') },
      { icon: CreditCard, title: t('landing.f3Title'), body: t('landing.f3Body') },
      { icon: MessageSquare, title: t('landing.f4Title'), body: t('landing.f4Body') },
      { icon: Megaphone, title: t('landing.f5Title'), body: t('landing.f5Body') },
      { icon: FileText, title: t('landing.f6Title'), body: t('landing.f6Body') },
    ]

    return (
      <section id="features" className="scroll-mt-20 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title={t('landing.featuresTitle')}
            sub={t('landing.featuresSub')}
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-card border border-slate-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-inset ring-brand-100 transition-transform duration-200 group-hover:scale-105">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  function HowItWorks() {
    const steps = [
      { icon: Camera, title: t('landing.s1Title'), body: t('landing.s1Body') },
      { icon: Receipt, title: t('landing.s2Title'), body: t('landing.s2Body') },
      { icon: CreditCard, title: t('landing.s3Title'), body: t('landing.s3Body') },
      { icon: CheckCircle2, title: t('landing.s4Title'), body: t('landing.s4Body') },
    ]

    return (
      <section
        id="how"
        className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t('landing.howTitle')} sub={t('landing.howSub')} />

          <ol className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Connecting line sa desktop */}
            <div
              aria-hidden
              className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-brand-200 via-brand-200 to-transparent lg:block"
            />
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="relative rounded-card border border-slate-200 bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-raised"
              >
                <div className="flex items-center gap-3">
                  <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand">
                    <Icon className="size-5" />
                    <span className="tabular absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border-2 border-white bg-slate-900 text-[0.625rem] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    )
  }

  function Faq() {
    const qa = [
      { q: t('landing.q1'), a: t('landing.a1') },
      { q: t('landing.q2'), a: t('landing.a2') },
      { q: t('landing.q3'), a: t('landing.a3') },
      { q: t('landing.q4'), a: t('landing.a4') },
      { q: t('landing.q5'), a: t('landing.a5') },
      { q: t('landing.q6'), a: t('landing.a6') },
    ]
    const [open, setOpen] = useState<number | null>(0)

    return (
      <section id="faq" className="scroll-mt-20 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t('landing.faqTitle')} />
          <div className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
            {qa.map((item, i) => {
              const isOpen = open === i
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5"
                  >
                    <span className="flex-1 text-[0.9375rem] font-medium text-slate-900">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={cn(
                        'mt-0.5 size-5 shrink-0 text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {isOpen && (
                    <p className="animate-in px-4 pb-4 text-sm leading-relaxed text-slate-600 sm:px-5">
                      {item.a}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  function Contact() {
    const rows = [
      { icon: MapPin, label: t('landing.office'), value: 'Santa Cicilia Subdivision, Clubhouse' },
      { icon: Clock, label: t('landing.officeHours'), value: t('landing.officeHoursValue') },
      { icon: Phone, label: t('landing.phone'), value: '0900 000 0000' },
      { icon: Mail, label: t('landing.email'), value: 'billing@santacicilia.ph' },
    ]

    return (
      <section
        id="contact"
        className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t('landing.contactTitle')} sub={t('landing.contactSub')} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {rows.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-0.5 break-words text-[0.9375rem] font-medium text-slate-900">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  function CtaBanner() {
    return (
      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-xl2 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 px-6 py-12 shadow-float sm:px-10 sm:py-14">
          {/* Dekorasyon: grid + glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brand-400/20 blur-3xl"
          />
          <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {t('landing.ctaBannerTitle')}
              </h2>
              <p className="mt-2 text-brand-100">{t('landing.ctaBannerSub')}</p>
            </div>
            <Link to="/register" className="w-full shrink-0 lg:w-auto">
              <Button
                size="lg"
                block
                className="border-0 bg-white from-white to-white text-brand-800 shadow-lg ring-0 hover:bg-brand-50 hover:to-brand-50 active:bg-brand-100"
                iconRight={<ArrowRight className="size-4" />}
              >
                {t('landing.ctaPrimary')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    )
  }

  function Footer() {
    const year = new Date().getFullYear()
    return (
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-start gap-3">
            <LogoMark className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {t('app.subdivision')}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">{t('landing.footerNote')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            © {year} {t('app.subdivision')}. {t('landing.footerRights')}
          </p>
        </div>
      </footer>
    )
  }
}

function SectionHeading({
  title,
  sub,
  center = true,
}: {
  title: string
  sub?: string
  center?: boolean
}) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
        {title}
      </h2>
      {sub && <p className="mt-3 text-[1.0625rem] leading-relaxed text-slate-600">{sub}</p>}
    </div>
  )
}
