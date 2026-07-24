import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bell, Clock, LogOut, Menu, Phone, X } from 'lucide-react'
import { Logo, LogoMark } from '@/components/Logo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { NAV_BY_ROLE, type NavGroup } from '@/components/nav-config'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { initials } from '@/lib/format'
import type { Role } from '@/types/domain'
import { cn } from '@/lib/cn'

const ROLE_TONE: Record<Role, BadgeTone> = {
  admin: 'brand',
  staff: 'info',
  homeowner: 'neutral',
}

/**
 * Balangkas ng lahat ng naka-login na screen (homeowner/staff/admin).
 * Sidebar sa desktop, off-canvas drawer sa mobile.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useT()
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  const role = profile?.role ?? 'homeowner'
  const groups = NAV_BY_ROLE[role]

  useEffect(() => setDrawer(false), [location.pathname])
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawer])

  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[17rem_1fr]">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-5">
          <Logo subdivision={t('app.subdivision')} tagline={t('app.tagline')} />
        </div>
        <SidebarNav groups={groups} />
        <SupportCard />
        <SidebarUser />
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      {drawer && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
            aria-hidden
          />
          <aside className="animate-in fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-overlay">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
              <Logo subdivision={t('app.subdivision')} tagline={t('app.tagline')} />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label={t('nav.close')}
                className="grid size-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav groups={groups} />
            <SupportCard />
            <SidebarUser />
          </aside>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t('nav.menu')}
            className="grid size-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="min-w-0 flex-1 lg:hidden">
            <LogoMark className="size-9" />
          </div>

          {/* Page context sa desktop — para hindi bakante ang bar */}
          <p className="hidden min-w-0 flex-1 truncate text-sm font-medium text-slate-400 lg:block">
            {t('app.subdivision')}
          </p>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Badge tone={ROLE_TONE[role]} className="hidden capitalize sm:inline-flex">
              {role}
            </Badge>
            <button
              type="button"
              aria-label="Notifications"
              title={t('sidebar.soon')}
              className="relative grid size-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <Bell className="size-[1.15rem]" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-500 ring-2 ring-white" />
            </button>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <LanguageToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )

  function SupportCard() {
    return (
      <div className="px-3 pb-2">
        <div className="rounded-card border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-xs font-semibold text-slate-700">{t('app.subdivision')}</p>
          <div className="mt-2 space-y-1.5 text-xs text-slate-500">
            <p className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0 text-slate-400" />
              {t('landing.officeHoursValue')}
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0 text-slate-400" />
              0900 000 0000
            </p>
          </div>
        </div>
      </div>
    )
  }

  function SidebarUser() {
    return (
      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-semibold text-white shadow-sm">
            {initials(profile?.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {profile?.full_name}
            </p>
            <p className="truncate text-xs text-slate-500">{profile?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-1 flex w-full items-center gap-2.5 rounded-input px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="size-4 text-slate-400" />
          {t('common.signOut')}
        </button>
      </div>
    )
  }
}

function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const { t } = useT()
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.labelKey && (
            <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">
              {t(group.labelKey)}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon
              if (item.soon) {
                return (
                  <li key={item.to}>
                    <span className="flex cursor-not-allowed items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium text-slate-400">
                      <Icon className="size-[1.15rem] shrink-0 opacity-70" />
                      <span className="flex-1 truncate">{t(item.labelKey)}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wide text-slate-400">
                        {t('sidebar.soon')}
                      </span>
                    </span>
                  </li>
                )
              }
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-input px-3 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-brand-50 font-semibold text-brand-800'
                          : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-600" />
                        )}
                        <Icon
                          className={cn(
                            'size-[1.15rem] shrink-0',
                            isActive
                              ? 'text-brand-700'
                              : 'text-slate-400 group-hover:text-slate-600',
                          )}
                        />
                        <span className="flex-1 truncate">{t(item.labelKey)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Pamagat ng page + optional na aksyon sa gilid. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
