import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, Droplets, Pencil, Zap } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { RateFormModal } from '@/features/billing/RateFormModal'
import { fetchRates } from '@/features/billing/billing-api'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { money, shortDate } from '@/lib/format'
import type { Rate, RateKind } from '@/types/domain'

const KINDS: { kind: RateKind; icon: typeof Droplets; tint: string }[] = [
  { kind: 'water', icon: Droplets, tint: 'bg-water-50 text-water-700 ring-water-100' },
  { kind: 'electric', icon: Zap, tint: 'bg-power-50 text-power-700 ring-power-100' },
  { kind: 'assoc_dues', icon: Building2, tint: 'bg-brand-50 text-brand-700 ring-brand-100' },
  { kind: 'penalty', icon: AlertTriangle, tint: 'bg-warning-50 text-warning-700 ring-warning-100' },
]

export default function AdminRates() {
  const { t } = useT()
  const [editing, setEditing] = useState<RateKind | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['rates'], queryFn: fetchRates })
  const rates = data ?? []
  const today = new Date().toISOString().slice(0, 10)

  function current(kind: RateKind): Rate | undefined {
    return rates.find((r) => r.kind === kind && !r.effective_to)
  }

  function summary(kind: RateKind, r?: Rate): string {
    if (!r) return t('billing.noRate')
    if (kind === 'water' || kind === 'electric')
      return `${money(r.rate_per_unit)} / ${kind === 'water' ? 'm³' : 'kWh'}${
        r.minimum_charge > 0 ? ` · min ${money(r.minimum_charge)}` : ''
      }`
    if (kind === 'assoc_dues') return money(r.fixed_amount)
    return `${r.penalty_percent}%${r.penalty_fixed > 0 ? ` + ${money(r.penalty_fixed)}` : ''}`
  }

  return (
    <AppShell>
      <PageHeader title={t('billing.ratesTitle')} description={t('billing.ratesSub')} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {KINDS.map(({ kind, icon: Icon, tint }) => {
            const r = current(kind)
            return (
              <Card key={kind}>
                <CardBody className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${tint}`}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {t(`billing.${kind === 'assoc_dues' ? 'dues' : kind}`)}
                      </p>
                      <p className="tabular mt-0.5 text-lg font-bold text-brand-800">
                        {summary(kind, r)}
                      </p>
                      {r && (
                        <p className="text-xs text-slate-400">
                          {t('billing.effectiveFrom')}: {shortDate(r.effective_from)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(kind)}
                    iconLeft={<Pencil className="size-3.5" />}
                  >
                    {t('common.edit')}
                  </Button>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <RateFormModal open onClose={() => setEditing(null)} kind={editing} today={today} />
      )}
    </AppShell>
  )
}
