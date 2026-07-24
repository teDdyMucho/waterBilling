import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

export function StatTile({
  icon,
  label,
  value,
  tint = 'brand',
  hint,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tint?: 'brand' | 'water' | 'power' | 'success' | 'warning' | 'info' | 'neutral'
  hint?: string
}) {
  const tints: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    water: 'bg-water-50 text-water-700 ring-water-100',
    power: 'bg-power-50 text-power-700 ring-power-100',
    success: 'bg-success-50 text-success-700 ring-success-100',
    warning: 'bg-warning-50 text-warning-700 ring-warning-100',
    info: 'bg-info-50 text-info-700 ring-info-100',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset',
            tints[tint],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="tabular mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
      </div>
    </Card>
  )
}
