import type { LucideIcon } from 'lucide-react'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

type Tint = 'brand' | 'water' | 'power' | 'success' | 'info'

const TINTS: Record<Tint, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  water: 'bg-water-50 text-water-700 ring-water-100',
  power: 'bg-power-50 text-power-700 ring-power-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
}

export interface FeatureItem {
  icon: LucideIcon
  title: string
  desc: string
  tint?: Tint
}

/** Grid ng darating na features — malinis na "preview" imbes na blangkong tiles. */
export function FeaturePreviewGrid({ items }: { items: FeatureItem[] }) {
  const { t } = useT()
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, desc, tint = 'brand' }) => (
        <div
          key={title}
          className="group relative overflow-hidden rounded-card border border-slate-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised"
        >
          <div className="flex items-start justify-between">
            <span
              className={cn(
                'grid size-11 place-items-center rounded-xl ring-1 ring-inset transition-transform duration-200 group-hover:scale-105',
                TINTS[tint],
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-slate-400">
              {t('sidebar.soon')}
            </span>
          </div>
          <h3 className="mt-4 text-[0.9375rem] font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{desc}</p>
        </div>
      ))}
    </div>
  )
}
