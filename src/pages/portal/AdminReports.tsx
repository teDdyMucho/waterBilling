import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Banknote, PiggyBank, TrendingUp, Wallet } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import {
  fetchAging,
  fetchCollectionByCycle,
  fetchDashboardStats,
  fetchPaymentLog,
} from '@/features/reports/reports-api'
import { StatTile } from '@/components/ui/StatTile'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { money, shortDate } from '@/lib/format'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/cn'

type Tab = 'collection' | 'aging' | 'payments'

export default function AdminReports() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('collection')

  const stats = useQuery({ queryKey: ['dash-stats'], queryFn: fetchDashboardStats })
  const collection = useQuery({ queryKey: ['rpt-collection'], queryFn: fetchCollectionByCycle })
  const aging = useQuery({ queryKey: ['rpt-aging'], queryFn: fetchAging })
  const payLog = useQuery({ queryKey: ['rpt-payments'], queryFn: fetchPaymentLog })

  const s = stats.data

  const tabs: Tab[] = ['collection', 'aging', 'payments']

  function exportCurrent() {
    if (tab === 'collection' && collection.data)
      downloadCsv(
        'collection-report.csv',
        collection.data.map((r) => ({
          cycle: r.cycle,
          billed: r.billed.toFixed(2),
          collected: r.collected.toFixed(2),
          outstanding: r.outstanding.toFixed(2),
          rate: (r.rate * 100).toFixed(1) + '%',
        })),
      )
    if (tab === 'aging' && aging.data)
      downloadCsv(
        'aging-report.csv',
        aging.data.map((r) => ({
          bill_no: r.bill_no,
          property: r.property,
          balance: r.balance.toFixed(2),
          days_overdue: r.daysOverdue,
          bucket: r.bucket,
        })),
      )
    if (tab === 'payments' && payLog.data)
      downloadCsv(
        'payment-log.csv',
        payLog.data.map((r) => ({
          or_no: r.or_no,
          payment_no: r.payment_no,
          payer: r.payer,
          amount: r.amount.toFixed(2),
          method: r.method,
          date: r.date,
        })),
      )
  }

  return (
    <AppShell>
      <PageHeader
        title={t('reports.title')}
        description={t('reports.sub')}
        action={
          <Button variant="outline" onClick={exportCurrent} iconLeft={<Download className="size-4" />}>
            {t('reports.export')}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Banknote className="size-5" />} label={t('reports.billed')} value={money(s?.billed ?? 0)} tint="brand" />
        <StatTile icon={<PiggyBank className="size-5" />} label={t('reports.collected')} value={money(s?.collected ?? 0)} tint="success" />
        <StatTile icon={<Wallet className="size-5" />} label={t('reports.outstanding')} value={money(s?.outstanding ?? 0)} tint="warning" />
        <StatTile icon={<TrendingUp className="size-5" />} label={t('reports.rate')} value={`${((s?.collectionRate ?? 0) * 100).toFixed(1)}%`} tint="info" />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTab(f)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              tab === f ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
            )}
          >
            {t(`reports.tab_${f}`)}
          </button>
        ))}
      </div>

      <Card>
        <div className="scroll-x">
          {tab === 'collection' && (
            <ReportTable
              loading={collection.isLoading}
              headers={[t('reports.cycle'), t('reports.billed'), t('reports.collected'), t('reports.outstanding'), t('reports.rate')]}
              rows={(collection.data ?? []).map((r) => [
                r.cycle,
                money(r.billed),
                money(r.collected),
                money(r.outstanding),
                `${(r.rate * 100).toFixed(1)}%`,
              ])}
            />
          )}
          {tab === 'aging' && (
            <ReportTable
              loading={aging.isLoading}
              headers={[t('reports.col_billNo'), t('reports.col_property'), t('reports.col_balance'), t('reports.col_days'), t('reports.col_bucket')]}
              rows={(aging.data ?? []).map((r) => [r.bill_no, r.property, money(r.balance), String(r.daysOverdue), r.bucket])}
            />
          )}
          {tab === 'payments' && (
            <ReportTable
              loading={payLog.isLoading}
              headers={[t('reports.col_or'), t('reports.col_payer'), t('reports.col_amount'), t('reports.col_method'), t('reports.col_date')]}
              rows={(payLog.data ?? []).map((r) => [r.or_no, r.payer, money(r.amount), r.method, shortDate(r.date)])}
            />
          )}
        </div>
      </Card>
    </AppShell>
  )
}

function ReportTable({
  headers,
  rows,
  loading,
}: {
  headers: string[]
  rows: (string | number)[][]
  loading: boolean
}) {
  const { t } = useT()
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
        <Spinner className="size-4" /> {t('common.loading')}
      </div>
    )
  }
  if (rows.length === 0) {
    return <p className="py-14 text-center text-sm text-slate-400">{t('reports.empty')}</p>
  }
  return (
    <table className="w-full min-w-[36rem] text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          {headers.map((h, i) => (
            <th key={i} className={cn('px-5 py-3', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r, ri) => (
          <tr key={ri} className="hover:bg-slate-50/60">
            {r.map((c, ci) => (
              <td key={ci} className={cn('px-5 py-3', ci === 0 ? 'font-medium text-slate-900' : 'tabular text-right text-slate-700')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
