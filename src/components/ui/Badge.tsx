import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'water'
  | 'power'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

/**
 * Color-coded status badges. Ang kulay ay nagbibigay ng mabilisang senyas ng
 * estado (semantic status colors — sanctioned exception sa monochrome UI):
 *   • success (green)  = positive / tapos (open, paid, confirmed, active)
 *   • info (blue)      = ginagawa (reading, in-progress, staff)
 *   • warning (amber)  = naghihintay / alerto (billed, unpaid, pending)
 *   • danger (red)     = problema (overdue, rejected, escalated, blocked)
 *   • neutral (gray)   = tapos-na/tahimik (closed, draft, inactive)
 *   • brand (dark)     = admin / brand emphasis
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-brand-800 text-white ring-brand-800',
  water: 'bg-sky-50 text-sky-700 ring-sky-200',
  power: 'bg-amber-50 text-amber-700 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
