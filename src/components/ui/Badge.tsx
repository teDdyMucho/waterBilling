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
 * Monochrome status badges — pinag-iiba sa fill-shade, border, at weight
 * (hindi sa kulay), ayon sa premium na monochrome na disenyo:
 *   • solid dark   = tapos / positive (success, brand, confirmed, paid)
 *   • outline bold = alerto (danger, overdue, rejected, escalated)
 *   • light fill   = naghihintay (warning, neutral)
 *   • medium fill  = ginagawa (info)
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-brand-800 text-white ring-brand-800',
  water: 'bg-slate-100 text-slate-700 ring-slate-200',
  power: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-brand-800 text-white ring-brand-800',
  warning: 'bg-slate-100 text-slate-700 ring-slate-300',
  danger: 'bg-white text-brand-800 ring-brand-700 font-semibold',
  info: 'bg-slate-200 text-slate-800 ring-slate-300',
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
