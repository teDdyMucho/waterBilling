import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Receipt, ShieldCheck, XCircle } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { fetchMyPayments } from '@/features/payments/payments-api'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { dateTime, money } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Payment, PaymentStatus } from '@/types/domain'

const TONE: Record<PaymentStatus, BadgeTone> = {
  submitted: 'info',
  endorsed: 'warning',
  confirmed: 'success',
  rejected: 'danger',
  voided: 'neutral',
}

export default function HomeownerPayments() {
  const { t } = useT()
  const { data, isLoading } = useQuery({ queryKey: ['my-payments'], queryFn: fetchMyPayments })
  const payments = data ?? []

  return (
    <AppShell>
      <PageHeader title={t('payments.historyTitle')} description={t('payments.historySub')} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <div className="p-5">
            <EmptyState icon={<Receipt className="size-6" />} title={t('payments.noPayments')} />
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => (
            <PaymentCard key={p.id} payment={p} />
          ))}
        </div>
      )}
    </AppShell>
  )
}

function PaymentCard({
  payment: p,
}: {
  payment: Payment & { bill: { bill_no: string } | null }
}) {
  const { t } = useT()
  const rejected = p.status === 'rejected'
  const voided = p.status === 'voided'

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="tabular text-lg font-bold text-slate-900">{money(p.amount)}</p>
            <p className="text-xs text-slate-500">
              {p.payment_no}
              {p.bill?.bill_no && ` · ${p.bill.bill_no}`} · {t(`payments.m_${p.method}`)}
            </p>
          </div>
          <Badge tone={TONE[p.status]}>{t(`payments.st_${p.status}`)}</Badge>
        </div>

        {/* Status timeline */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('payments.timeline')}
          </p>
          <ol className="space-y-0">
            <Step
              done
              icon={<Receipt className="size-3.5" />}
              label={t('payments.tl_submitted')}
              date={p.created_at}
              last={rejected}
            />
            {!rejected && !voided && (
              <>
                <Step
                  done={Boolean(p.endorsed_at)}
                  icon={<ShieldCheck className="size-3.5" />}
                  label={t('payments.tl_endorsed')}
                  date={p.endorsed_at}
                />
                <Step
                  done={p.status === 'confirmed'}
                  icon={<CheckCircle2 className="size-3.5" />}
                  label={t('payments.tl_confirmed')}
                  date={p.confirmed_at}
                  last
                />
              </>
            )}
            {rejected && (
              <Step
                done
                tone="danger"
                icon={<XCircle className="size-3.5" />}
                label={`${t('payments.st_rejected')}${p.rejection_reason ? ' · ' + p.rejection_reason : ''}`}
                date={p.updated_at}
                last
              />
            )}
            {voided && (
              <Step
                done
                tone="neutral"
                icon={<XCircle className="size-3.5" />}
                label={`${t('payments.st_voided')}${p.void_reason ? ' · ' + p.void_reason : ''}`}
                date={p.updated_at}
                last
              />
            )}
          </ol>
        </div>

        {/* OR number kapag confirmed */}
        {p.status === 'confirmed' && p.official_receipt_no && (
          <div className="mt-3 flex items-center gap-2 rounded-input bg-success-50 px-3.5 py-2.5 text-sm text-success-700 ring-1 ring-inset ring-success-100">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              {t('payments.orNo')}: <strong>{p.official_receipt_no}</strong>
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function Step({
  done,
  icon,
  label,
  date,
  last,
  tone = 'brand',
}: {
  done: boolean
  icon: React.ReactNode
  label: string
  date?: string | null
  last?: boolean
  tone?: 'brand' | 'danger' | 'neutral'
}) {
  const toneCls = {
    brand: done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400',
    danger: 'bg-danger-600 text-white',
    neutral: 'bg-slate-400 text-white',
  }[tone]

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', toneCls)}>
          {done ? icon : <Clock className="size-3.5" />}
        </span>
        {!last && <span className={cn('w-0.5 flex-1', done ? 'bg-brand-200' : 'bg-slate-200')} />}
      </div>
      <div className={cn('min-w-0 pb-4', last && 'pb-0')}>
        <p className={cn('text-sm font-medium', done ? 'text-slate-900' : 'text-slate-400')}>
          {label}
        </p>
        {date && <p className="text-xs text-slate-400">{dateTime(date)}</p>}
      </div>
    </li>
  )
}
