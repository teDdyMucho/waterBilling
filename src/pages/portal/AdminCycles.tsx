import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, FileText, Plus, Receipt, Send, TriangleAlert } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { CycleFormModal } from '@/features/readings/CycleFormModal'
import { fetchCycles } from '@/features/readings/readings-api'
import {
  applyPenalties,
  fetchBillsForCycle,
  generateBills,
  releaseBills,
} from '@/features/billing/billing-api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { money, shortDate } from '@/lib/format'
import type { BillStatus, CycleStatus } from '@/types/domain'

const TONE: Record<CycleStatus, BadgeTone> = {
  open: 'success',
  reading: 'info',
  billed: 'warning',
  closed: 'neutral',
}
const BILL_TONE: Record<BillStatus, BadgeTone> = {
  draft: 'neutral',
  unpaid: 'warning',
  payment_pending: 'info',
  partially_paid: 'info',
  paid: 'success',
  overdue: 'danger',
  voided: 'neutral',
}

export default function AdminCycles() {
  const { t } = useT()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [viewBills, setViewBills] = useState<{ id: string; code: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['cycles'], queryFn: fetchCycles })
  const cycles = data ?? []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cycles'] })
    qc.invalidateQueries({ queryKey: ['bills'] })
  }

  const mGen = useMutation({
    mutationFn: generateBills,
    onSuccess: (n) => {
      setNote(t('billing.generated').replace('{n}', String(n)))
      invalidate()
    },
  })
  const mRel = useMutation({
    mutationFn: releaseBills,
    onSuccess: (n) => {
      setNote(t('billing.released').replace('{n}', String(n)))
      invalidate()
    },
  })
  const mPen = useMutation({
    mutationFn: applyPenalties,
    onSuccess: (n) => {
      setNote(t('billing.penaltiesApplied').replace('{n}', String(n)))
      invalidate()
    },
  })

  const busy = mGen.isPending || mRel.isPending || mPen.isPending

  return (
    <AppShell>
      <PageHeader
        title={t('readings.cyclesTitle')}
        description={t('readings.cyclesSub')}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => mPen.mutate()}
              loading={mPen.isPending}
              iconLeft={<TriangleAlert className="size-4" />}
            >
              {t('billing.applyPenalty')}
            </Button>
            <Button onClick={() => setOpen(true)} iconLeft={<Plus className="size-4" />}>
              {t('readings.newCycle')}
            </Button>
          </div>
        }
      />

      {note && (
        <Alert tone="success" className="mb-4">
          {note}
        </Alert>
      )}

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : cycles.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<CalendarClock className="size-6" />} title={t('readings.noCycles')} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cycles.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                    <CalendarClock className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{c.code}</p>
                      <Badge tone={TONE[c.status]}>{t(`readings.status${cap(c.status)}`)}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {c.due_date ? `${t('billing.dueDate')}: ${shortDate(c.due_date)}` : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setNote(null)
                      mGen.mutate(c.id)
                    }}
                    iconLeft={<Receipt className="size-3.5" />}
                  >
                    {t('billing.generate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t('billing.confirmRelease'))) {
                        setNote(null)
                        mRel.mutate(c.id)
                      }
                    }}
                    iconLeft={<Send className="size-3.5" />}
                  >
                    {t('billing.release')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewBills({ id: c.id, code: c.code })}
                    iconLeft={<FileText className="size-3.5" />}
                  >
                    {t('billing.viewBills')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CycleFormModal open={open} onClose={() => setOpen(false)} />
      {viewBills && (
        <BillsModal cycle={viewBills} onClose={() => setViewBills(null)} billTone={BILL_TONE} />
      )}
    </AppShell>
  )
}

function BillsModal({
  cycle,
  onClose,
  billTone,
}: {
  cycle: { id: string; code: string }
  onClose: () => void
  billTone: Record<BillStatus, BadgeTone>
}) {
  const { t } = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['bills', cycle.id],
    queryFn: () => fetchBillsForCycle(cycle.id),
  })
  const bills = data ?? []
  const total = bills.reduce((s, b) => s + Number(b.total_amount), 0)

  return (
    <Modal
      open
      onClose={onClose}
      title={t('billing.billsFor').replace('{code}', cycle.code)}
      description={`${bills.length} ${t('billing.billCount')} · ${t('billing.totalBilled')}: ${money(total)}`}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          {t('readings.done')}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : bills.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('billing.noBills')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {bills.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  Blk {b.property?.block} Lot {b.property?.lot}
                </p>
                <p className="text-xs text-slate-400">{b.bill_no}</p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-semibold text-slate-900">{money(b.total_amount)}</p>
                <Badge tone={billTone[b.status]}>{t(`billing.st_${b.status}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
