import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Droplets, Zap } from 'lucide-react'
import { getSignedPhotoUrl } from '@/features/readings/readings-api'
import {
  fetchPropertyBillHistory,
  type BillPhotoItem,
} from '@/features/billing/billing-api'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { consumption as fmtConsumption, meterReading, money, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Bill, BillStatus } from '@/types/domain'

const HISTORY_TONE: Record<BillStatus, BadgeTone> = {
  draft: 'neutral',
  unpaid: 'warning',
  payment_pending: 'info',
  partially_paid: 'info',
  paid: 'success',
  overdue: 'danger',
  voided: 'neutral',
}

/**
 * Buwan-buwang kasaysayan ng property na ito. Sunod-sunod ang mga cycle,
 * kaya dito nakikita ang pattern ng konsumo at kung may naiwang hindi
 * nabayaran sa mga naunang buwan.
 */
export function PropertyBillHistory({
  propertyId,
  currentBillId,
}: {
  propertyId: string
  currentBillId: string
}) {
  const { t } = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['property-bill-history', propertyId],
    queryFn: () => fetchPropertyBillHistory(propertyId),
  })
  const rows = data ?? []

  if (isLoading) return null
  if (rows.length <= 1) {
    return <p className="text-sm text-slate-400">{t('billing.noHistory')}</p>
  }

  return (
    <ul className="overflow-hidden rounded-input border border-slate-200 divide-y divide-slate-100">
      {rows.map((b) => {
        const water = b.items?.find((i) => i.item_type === 'water')?.quantity ?? null
        const electric = b.items?.find((i) => i.item_type === 'electric')?.quantity ?? null
        const isCurrent = b.id === currentBillId
        return (
          <li
            key={b.id}
            className={cn(
              'flex items-center justify-between gap-3 px-3.5 py-2',
              isCurrent && 'bg-slate-50',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {b.cycle?.code ?? b.bill_no}
                {isCurrent && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {t('billing.thisBill')}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {[
                  water != null ? fmtConsumption(water, 'water') : null,
                  electric != null ? fmtConsumption(electric, 'electric') : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="tabular text-sm font-semibold text-slate-900">{money(b.total_amount)}</p>
              <Badge tone={HISTORY_TONE[b.status]}>{t(`billing.st_${b.status}`)}</Badge>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Ano ang nasa bill — ang mismong hati-hati ng singil na ginawa ng
 * generate_bills. Ipinapakita lang ang mga linyang may halaga.
 */
export function BillBreakdown({ bill }: { bill: Bill }) {
  const { t } = useT()

  const lines: { label: string; amount: number }[] = [
    { label: t('billing.previousBalance'), amount: Number(bill.previous_balance) },
    { label: t('properties.water'), amount: Number(bill.water_amount) },
    { label: t('properties.electric'), amount: Number(bill.electric_amount) },
    { label: t('billing.dues'), amount: Number(bill.assoc_dues) },
    { label: t('billing.penaltyAmount'), amount: Number(bill.penalty_amount) },
  ].filter((l) => l.amount !== 0)

  const paid = Number(bill.amount_paid)

  return (
    <div className="overflow-hidden rounded-input border border-slate-200">
      <ul className="divide-y divide-slate-100">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center justify-between px-3.5 py-2 text-sm">
            <span className="text-slate-600">{l.label}</span>
            <span className="tabular text-slate-900">{money(l.amount)}</span>
          </li>
        ))}

        <li className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5">
          <span className="text-sm font-semibold text-slate-900">{t('billing.totalDue')}</span>
          <span className="tabular text-sm font-bold text-slate-900">{money(bill.total_amount)}</span>
        </li>

        {paid > 0 && (
          <>
            <li className="flex items-center justify-between px-3.5 py-2 text-sm">
              <span className="text-slate-600">{t('billing.amountPaid')}</span>
              <span className="tabular text-slate-900">{money(paid)}</span>
            </li>
            <li className="flex items-center justify-between px-3.5 py-2 text-sm">
              <span className="text-slate-600">{t('billing.balance')}</span>
              <span className="tabular font-semibold text-slate-900">{money(bill.balance)}</span>
            </li>
          </>
        )}

        {bill.due_date && (
          <li className="flex items-center justify-between px-3.5 py-2 text-xs text-slate-500">
            <span>{t('billing.dueDate')}</span>
            <span>{shortDate(bill.due_date)}</span>
          </li>
        )}
      </ul>
    </div>
  )
}

/**
 * Basa at litrato ng metro sa likod ng isang bill — kapareho ng nakikita
 * ng staff kapag nabasa na ang metro: tab kada utility, ang tatlong numero,
 * ang status, at ang litratong ebidensya.
 */
const UTILITIES = ['water', 'electric'] as const

export function BillReadingDetail({ items }: { items: BillPhotoItem[] }) {
  const { t } = useT()
  const [tab, setTab] = useState<(typeof UTILITIES)[number]>('water')

  // LAGING dalawa ang tab. Kapag walang basa ang isa, sinasabi nitong wala —
  // mahalagang makita kung ano ang kulang, hindi lang kung ano ang meron.
  const byUtility = {
    water: items.find((i) => i.item_type === 'water' && i.reading) ?? null,
    electric: items.find((i) => i.item_type === 'electric' && i.reading) ?? null,
  }
  const active = byUtility[tab]

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {UTILITIES.map((u) => {
          const isWater = u === 'water'
          const Icon = isWater ? Droplets : Zap
          const has = Boolean(byUtility[u])
          return (
            <button
              key={u}
              type="button"
              onClick={() => setTab(u)}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                u === tab
                  ? 'bg-brand-700 text-white'
                  : has
                    ? 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                    : 'bg-white text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
              )}
            >
              <Icon className="size-4" />
              {t(isWater ? 'properties.water' : 'properties.electric')}
              {!has && <span className="text-xs">— {t('readings.notRead')}</span>}
            </button>
          )
        })}
      </div>

      {!active ? (
        <p className="py-6 text-center text-sm text-slate-400">{t('billing.noReadingPhoto')}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label={t('readings.previous')} value={meterReading(active.reading!.previous_reading)} />
            <Stat label={t('readings.present')} value={meterReading(active.reading!.present_reading)} />
            <Stat
              label={t('readings.consumption')}
              value={fmtConsumption(active.reading!.consumption, tab)}
            />
          </div>

          <Badge
            tone={
              active.reading!.status === 'verified'
                ? 'success'
                : active.reading!.status === 'for_review'
                  ? 'warning'
                  : 'neutral'
            }
          >
            {active.reading!.status === 'for_review'
              ? t('readings.flagged')
              : active.reading!.status}
          </Badge>

          <Photo path={active.reading!.photo_path} />
        </>
      )}
    </div>
  )
}

function Photo({ path }: { path: string }) {
  const { t } = useT()
  const { data: url, isLoading } = useQuery({
    queryKey: ['reading-photo', path],
    queryFn: () => getSignedPhotoUrl(path),
    // Ang signed URL ay 5 minuto lang — huwag i-cache nang mas matagal.
    staleTime: 4 * 60 * 1000,
  })

  if (isLoading || !url) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-input border border-slate-200 bg-slate-50 text-sm text-slate-400">
        <Spinner className="size-4" /> {t('common.loading')}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="meter"
      className="max-h-72 w-full rounded-input border border-slate-200 object-contain"
    />
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-input bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="tabular mt-0.5 text-sm font-bold text-slate-900">{value}</p>
    </div>
  )
}
