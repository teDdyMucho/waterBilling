import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Droplets, Receipt, Search, Zap } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { fetchAllBills, fetchBill } from '@/features/billing/billing-api'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader, Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { consumption as fmtCons, lotLabel, money, shortDate } from '@/lib/format'
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

export default function StaffBills() {
  const { t } = useT()
  const { id } = useParams()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['all-bills'], queryFn: fetchAllBills })
  const bills = data ?? []

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bills
    return bills.filter((b) =>
      `${b.property?.block ?? ''} ${b.property?.lot ?? ''} ${b.bill_no}`.toLowerCase().includes(q),
    )
  }, [bills, search])

  if (id) return <StaffBillDetail id={id} />

  return (
    <AppShell>
      <PageHeader title={t('billing.staffBillsTitle')} description={t('billing.staffBillsSub')} />

      <div className="mb-4 sm:max-w-xs">
        <Input
          placeholder={t('billing.searchBills')}
          iconLeft={<Search className="size-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Receipt className="size-6" />} title={t('billing.noMyBills')} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/staff/bills/${b.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
                    <Receipt className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {lotLabel(b.property?.block, b.property?.lot)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {b.bill_no} · {b.cycle?.code ?? '—'}
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
        )}
      </Card>
    </AppShell>
  )
}

function StaffBillDetail({ id }: { id: string }) {
  const { t } = useT()
  const { data: bill, isLoading } = useQuery({ queryKey: ['bill', id], queryFn: () => fetchBill(id) })

  if (isLoading) return <PageLoader />

  return (
    <AppShell>
      <Link
        to="/staff/bills"
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
          <Card>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {lotLabel(bill.property?.block, bill.property?.lot)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {bill.bill_no} · {bill.cycle?.code}
                  </p>
                </div>
                <Badge tone={TONE[bill.status]}>{t(`billing.st_${bill.status}`)}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-input bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t('billing.totalDue')}</p>
                  <p className="tabular text-lg font-bold text-slate-900">{money(bill.total_amount)}</p>
                </div>
                <div className="rounded-input bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{t('billing.balance')}</p>
                  <p className="tabular text-lg font-bold text-slate-900">{money(bill.balance)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {t('billing.dueDate')}: {shortDate(bill.due_date)}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('billing.currentCharges')} />
            <CardBody className="space-y-2">
              {bill.items?.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {it.item_type === 'water' && <Droplets className="size-4 text-slate-500" />}
                    {it.item_type === 'electric' && <Zap className="size-4 text-slate-500" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{it.description ?? it.item_type}</p>
                      {it.quantity != null && it.unit_price != null && (
                        <p className="text-xs text-slate-500">
                          {fmtCons(it.quantity, it.item_type === 'water' ? 'water' : 'electric')} × {money(it.unit_price)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="tabular text-sm font-semibold text-slate-900">{money(it.amount)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <p className="font-semibold text-slate-900">{t('billing.totalDue')}</p>
                <p className="tabular text-lg font-bold text-slate-900">{money(bill.total_amount)}</p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </AppShell>
  )
}
