import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Droplets, Receipt, Zap } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { fetchBill, fetchMyBills } from '@/features/billing/billing-api'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader, Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { consumption as fmtCons, money, shortDate } from '@/lib/format'
import type { BillStatus } from '@/types/domain'

const TONE: Record<BillStatus, BadgeTone> = {
  draft: 'neutral',
  unpaid: 'warning',
  payment_pending: 'info',
  partially_paid: 'info',
  paid: 'success',
  overdue: 'danger',
  voided: 'neutral',
}

export function HomeownerBills() {
  const { t } = useT()
  const { data, isLoading } = useQuery({ queryKey: ['my-bills'], queryFn: fetchMyBills })
  const bills = data ?? []

  return (
    <AppShell>
      <PageHeader title={t('billing.myBillsTitle')} description={t('billing.myBillsSub')} />
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : bills.length === 0 ? (
        <Card>
          <div className="p-5">
            <EmptyState icon={<Receipt className="size-6" />} title={t('billing.noMyBills')} />
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {bills.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/dashboard/bills/${b.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                    <Receipt className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{b.cycle?.code ?? b.bill_no}</p>
                    <p className="text-xs text-slate-500">
                      {t('billing.dueDate')}: {shortDate(b.due_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-semibold text-slate-900">{money(b.balance)}</p>
                    <Badge tone={TONE[b.status]}>{t(`billing.st_${b.status}`)}</Badge>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  )
}

export function HomeownerBillDetail() {
  const { t } = useT()
  const { id = '' } = useParams()
  const { data: bill, isLoading } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => fetchBill(id),
  })

  if (isLoading) return <PageLoader />

  return (
    <AppShell>
      <Link
        to="/dashboard/bills"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        {t('billing.backToBills')}
      </Link>

      {!bill ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">—</p>
          </CardBody>
        </Card>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Header */}
          <Card>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{bill.cycle?.code}</p>
                  <p className="text-xs text-slate-400">
                    {t('billing.billNo')}: {bill.bill_no}
                  </p>
                </div>
                <Badge tone={TONE[bill.status]}>{t(`billing.st_${bill.status}`)}</Badge>
              </div>
              <div className="mt-4 rounded-input bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t('billing.totalDue')}
                </p>
                <p className="tabular mt-1 text-3xl font-bold text-slate-900">
                  {money(bill.balance)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {t('billing.dueDate')}: {shortDate(bill.due_date)}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Line items */}
          <Card>
            <CardBody className="space-y-2">
              {bill.items
                ?.slice()
                .sort((a, b) => order(a.item_type) - order(b.item_type))
                .map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {it.item_type === 'water' && <Droplets className="size-4 text-water-600" />}
                      {it.item_type === 'electric' && <Zap className="size-4 text-power-600" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {it.description ?? it.item_type}
                        </p>
                        {it.quantity != null && it.unit_price != null && (
                          <p className="text-xs text-slate-500">
                            {fmtCons(it.quantity, it.item_type === 'water' ? 'water' : 'electric')} ×{' '}
                            {money(it.unit_price)}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="tabular text-sm font-semibold text-slate-900">{money(it.amount)}</p>
                  </div>
                ))}

              <div className="flex items-center justify-between pt-2">
                <p className="font-semibold text-slate-900">{t('billing.totalDue')}</p>
                <p className="tabular text-lg font-bold text-brand-800">
                  {money(bill.total_amount)}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Pay CTA (Phase 7) */}
          {bill.balance > 0 && (
            <Alert tone="info">{t('billing.paySoon')}</Alert>
          )}
        </div>
      )}
    </AppShell>
  )
}

function order(type: string): number {
  const o: Record<string, number> = {
    previous_balance: 0,
    water: 1,
    electric: 2,
    assoc_dues: 3,
    penalty: 4,
    adjustment: 5,
  }
  return o[type] ?? 9
}
