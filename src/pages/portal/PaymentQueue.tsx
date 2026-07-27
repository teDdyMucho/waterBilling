import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Image as ImageIcon, Search, ShieldCheck, X } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import {
  confirmPayment,
  endorsePayment,
  fetchPaymentsInStatuses,
  getProofUrl,
  rejectPayment,
} from '@/features/payments/payments-api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { money, shortDate } from '@/lib/format'
import type { PaymentStatus } from '@/types/domain'

const TONE: Record<PaymentStatus, BadgeTone> = {
  submitted: 'info',
  endorsed: 'warning',
  confirmed: 'success',
  rejected: 'danger',
  voided: 'neutral',
}

function PaymentQueue({ mode }: { mode: 'staff' | 'admin' }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [proof, setProof] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const statuses: PaymentStatus[] = mode === 'staff' ? ['submitted'] : ['submitted', 'endorsed']
  const { data, isLoading } = useQuery({
    queryKey: ['payment-queue', mode],
    queryFn: () => fetchPaymentsInStatuses(statuses),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payment-queue'] })
    qc.invalidateQueries({ queryKey: ['my-payments'] })
    qc.invalidateQueries({ queryKey: ['bills'] })
  }
  const onErr = (e: unknown) => setError(e instanceof Error ? e.message : t('common.somethingWrong'))

  const mEndorse = useMutation({
    mutationFn: (id: string) => endorsePayment(id, ''),
    onSuccess: () => {
      setNote(t('payments.endorsedOk'))
      invalidate()
    },
    onError: onErr,
  })
  const mConfirm = useMutation({
    mutationFn: (id: string) => confirmPayment(id),
    onSuccess: (or) => {
      setNote(t('payments.confirmedOk') + or)
      invalidate()
    },
    onError: onErr,
  })
  const mReject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectPayment(id, reason),
    onSuccess: invalidate,
    onError: onErr,
  })

  async function openProof(path: string | null) {
    if (!path) return
    try {
      setProof(await getProofUrl(path))
    } catch {
      setError(t('common.somethingWrong'))
    }
  }

  const allRows = data ?? []
  const q = search.trim().toLowerCase()
  const rows = q
    ? allRows.filter((p) =>
        `${p.submitter?.full_name ?? ''} ${p.payment_no} ${p.amount} ${t(`payments.m_${p.method}`)} ${
          p.reference_number ?? ''
        } ${p.bill?.bill_no ?? ''}`
          .toLowerCase()
          .includes(q),
      )
    : allRows
  const busy = mEndorse.isPending || mConfirm.isPending || mReject.isPending

  return (
    <AppShell>
      <PageHeader
        title={mode === 'staff' ? t('payments.endorseTitle') : t('payments.confirmTitle')}
        description={mode === 'staff' ? t('payments.endorseSub') : t('payments.confirmSub')}
      />

      {note && (
        <Alert tone="success" className="mb-4">
          {note}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="mb-4 sm:max-w-xs">
        <Input
          placeholder={t('payments.search')}
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
            <EmptyState
              icon={<ShieldCheck className="size-6" />}
              title={mode === 'staff' ? t('payments.noEndorse') : t('payments.noConfirm')}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => (
              <li key={p.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar url={p.submitter?.avatar_url} name={p.submitter?.full_name} size="md" className="bg-slate-400" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="tabular font-bold text-slate-900">{money(p.amount)}</p>
                      <Badge tone={TONE[p.status]}>{t(`payments.st_${p.status}`)}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{p.submitter?.full_name ?? '—'}</p>
                    <p className="text-xs text-slate-400">
                      {p.payment_no} · {t(`payments.m_${p.method}`)}
                      {p.reference_number && ` · Ref ${p.reference_number}`} · {shortDate(p.payment_date)}
                    </p>
                    {p.bill?.bill_no && (
                      <p className="text-xs text-slate-400">
                        {p.bill.bill_no} · {money(p.bill.balance)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openProof(p.proof_path)} iconLeft={<ImageIcon className="size-4" />}>
                    {t('payments.viewProof')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const r = window.prompt(t('payments.rejectReason'))
                      if (r && r.trim()) {
                        setError(null)
                        mReject.mutate({ id: p.id, reason: r.trim() })
                      }
                    }}
                    iconLeft={<X className="size-4" />}
                  >
                    {t('payments.reject')}
                  </Button>
                  {p.status === 'submitted' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setError(null)
                        mEndorse.mutate(p.id)
                      }}
                      iconLeft={<ShieldCheck className="size-4" />}
                    >
                      {t('payments.endorse')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="success"
                      disabled={busy || mode === 'staff'}
                      onClick={() => {
                        setError(null)
                        mConfirm.mutate(p.id)
                      }}
                      iconLeft={<Check className="size-4" />}
                    >
                      {t('payments.confirm')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={Boolean(proof)} onClose={() => setProof(null)} title={t('payments.viewProof')} size="lg">
        {proof && <img src={proof} alt="proof" className="max-h-[70vh] w-full rounded-input object-contain" />}
      </Modal>
    </AppShell>
  )
}

export function StaffPayments() {
  return <PaymentQueue mode="staff" />
}
export function AdminPayments() {
  return <PaymentQueue mode="admin" />
}
