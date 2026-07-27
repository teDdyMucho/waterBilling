import type { ReactNode } from 'react'
import { useT } from '@/hooks/useT'

/** Propesyonal na welcome banner sa itaas ng bawat role dashboard. */
export function WelcomeBanner({
  name,
  subtitle,
  badge,
  action,
}: {
  name: string
  subtitle: string
  badge?: ReactNode
  action?: ReactNode
}) {
  const { t } = useT()
  const greeting = `${t('portal.welcome')}${name ? ', ' + name : ''}`

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl2 bg-brand-900 p-6 shadow-raised ring-1 ring-inset ring-white/5 sm:p-7">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
            {greeting}
          </h1>
          <p className="mt-1 text-[0.9375rem] text-slate-400">{subtitle}</p>
          {badge && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-inset ring-white/15 backdrop-blur">
              {badge}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
