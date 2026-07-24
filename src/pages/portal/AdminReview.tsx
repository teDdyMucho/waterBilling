import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Image as ImageIcon, ShieldCheck, X } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import {
  fetchReadingsForReview,
  getSignedPhotoUrl,
  rejectReading,
  verifyReading,
  type ReviewReading,
} from '@/features/readings/readings-api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { consumption as fmtConsumption, lotLabel, meterReading } from '@/lib/format'

export default function AdminReview() {
  const { t } = useT()
  const qc = useQueryClient()
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['readings-review'],
    queryFn: fetchReadingsForReview,
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['readings-review'] })
    qc.invalidateQueries({ queryKey: ['worklist'] })
  }

  const mVerify = useMutation({
    mutationFn: verifyReading,
    onSuccess: invalidate,
    onError: () => setError(t('common.somethingWrong')),
  })
  const mReject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectReading(id, reason),
    onSuccess: invalidate,
    onError: () => setError(t('common.somethingWrong')),
  })

  async function openPhoto(path: string) {
    try {
      setPhoto(await getSignedPhotoUrl(path))
    } catch {
      setError(t('common.somethingWrong'))
    }
  }

  const rows = data ?? []
  const busy = mVerify.isPending || mReject.isPending

  return (
    <AppShell>
      <PageHeader title={t('readings.reviewTitle')} description={t('readings.reviewSub')} />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<ShieldCheck className="size-6" />} title={t('readings.noReview')} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <ReviewRow
                key={r.id}
                reading={r}
                busy={busy}
                onPhoto={() => openPhoto(r.photo_path)}
                onVerify={() => {
                  setError(null)
                  mVerify.mutate(r.id)
                }}
                onReject={() => {
                  const reason = window.prompt(t('readings.rejectReason'))
                  if (reason && reason.trim()) {
                    setError(null)
                    mReject.mutate({ id: r.id, reason: reason.trim() })
                  }
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <Modal open={Boolean(photo)} onClose={() => setPhoto(null)} title={t('readings.viewPhoto')} size="lg">
        {photo && <img src={photo} alt="meter" className="max-h-[70vh] w-full rounded-input object-contain" />}
      </Modal>
    </AppShell>
  )
}

function ReviewRow({
  reading: r,
  busy,
  onPhoto,
  onVerify,
  onReject,
}: {
  reading: ReviewReading
  busy: boolean
  onPhoto: () => void
  onVerify: () => void
  onReject: () => void
}) {
  const { t } = useT()
  const utility = r.meter?.utility_type ?? 'water'
  const digits = r.meter?.digits ?? 5

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">
            {lotLabel(r.meter?.property?.block, r.meter?.property?.lot)}
          </p>
          <Badge tone="warning">{utility === 'water' ? t('properties.water') : t('properties.electric')}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {meterReading(r.previous_reading, digits)} → {meterReading(r.present_reading, digits)} ·{' '}
          <span className="font-semibold text-warning-700">{fmtConsumption(r.consumption, utility)}</span>
        </p>
        {r.remarks && <p className="mt-0.5 text-sm italic text-slate-500">“{r.remarks}”</p>}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onPhoto} iconLeft={<ImageIcon className="size-4" />}>
          {t('readings.viewPhoto')}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onReject} iconLeft={<X className="size-4" />}>
          {t('readings.reject')}
        </Button>
        <Button size="sm" variant="success" disabled={busy} onClick={onVerify} iconLeft={<Check className="size-4" />}>
          {t('readings.verify')}
        </Button>
      </div>
    </li>
  )
}
