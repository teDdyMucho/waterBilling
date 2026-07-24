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
    <div className="relative mb-6 overflow-hidden rounded-xl2 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 shadow-raised sm:p-7">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute -right-12 -top-12 size-56 rounded-full bg-water-500/20 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 size-56 rounded-full bg-power-500/15 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
            {greeting}
          </h1>
          <p className="mt-1 text-[0.9375rem] text-brand-100/85">{subtitle}</p>
          {badge && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur">
              {badge}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
