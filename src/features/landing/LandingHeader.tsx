import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Menu, Phone, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Button } from '@/components/ui/Button'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

const LINKS = [
  { href: '#how', key: 'nav.how' },
  { href: '#features', key: 'nav.announcements' },
  { href: '#faq', key: 'nav.faq' },
  { href: '#contact', key: 'nav.contact' },
]

export function LandingHeader() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Huwag mag-scroll ang likod habang bukas ang drawer
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="sticky top-0 z-50">
      {/* Manipis na utility strip — "official portal" na pakiramdam */}
      <div className="hidden bg-brand-900 text-brand-50 lg:block">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-4 px-4 text-xs sm:px-6 lg:px-8">
          <p className="font-medium">{t('landing.footerNote')}</p>
          <div className="flex items-center gap-5 text-brand-100/90">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {t('landing.officeHoursValue')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" />
              0900 000 0000
            </span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'border-b transition-colors duration-200',
          scrolled
            ? 'border-slate-200/80 bg-white/85 backdrop-blur-xl'
            : 'border-slate-200/60 bg-white',
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="min-w-0 flex-1" aria-label={t('app.subdivision')}>
          <Logo subdivision={t('app.subdivision')} tagline={t('app.tagline')} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-input px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {t(l.key)}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageToggle />
          <Link to="/login">
            <Button variant="ghost" size="sm">
              {t('nav.login')}
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm">{t('nav.register')}</Button>
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t('nav.close') : t('nav.menu')}
            className="grid size-11 place-items-center rounded-input text-slate-700 transition-colors hover:bg-slate-100"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 top-16 z-40 bg-slate-900/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav className="animate-in relative z-50 border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-overlay">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center rounded-input px-3 text-[0.9375rem] font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                {t(l.key)}
              </a>
            ))}
            <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" block>
                  {t('nav.login')}
                </Button>
              </Link>
              <Link to="/register" onClick={() => setOpen(false)}>
                <Button block>{t('nav.register')}</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
