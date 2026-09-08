import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Droplets, HelpCircle, Maximize2, Trash2, Zap } from 'lucide-react'
import {
  assignUnassignedReading,
  discardUnassignedReading,
  fetchAllPendingUnassigned,
  fetchWorklist,
  getSignedPhotoUrl,
  type PendingUnassigned,
} from '@/features/readings/readings-api'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'
import type { UnassignedKind } from '@/types/domain'

/**
 * Isang tab sa Billing Cycles page: ang mga basang walang property.
 * Dito nagaganap ang confirmation — hangga't hindi naitalaga sa tunay na
 * metro, hindi ito nagiging reading at hindi ito nabi-bill.
 */
export function UnassignedTab({ kind }: { kind: UnassignedKind }) {
  const { t } = useT()
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['unassigned', 'all'],
    queryFn: fetchAllPendingUnassigned,
  })

  const rows = (data ?? []).filter((r) => r.kind === kind)

  return (
    <>
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Alert tone="info" className="mb-4">
        {t(kind === 'unknown' ? 'readings.unassignedHelpUnknown' : 'readings.unassignedHelpCo')}
      </Alert>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<HelpCircle className="size-6" />} title={t('readings.noUnassigned')} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <Row key={r.id} row={r} onError={setError} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function Row({
  row,
  onError,
}: {
  row: PendingUnassigned
  onError: (msg: string | null) => void
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const [meterId, setMeterId] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  // Maliit ang litrato sa listahan — dito ito binubuksan nang malaki.
  const [zoom, setZoom] = useState(false)

  const water = row.utility_type === 'water'
  const Icon = water ? Droplets : Zap

  // Ang mga metrong puwedeng pagtalagaan — galing sa worklist ng cycle
  // na pinagmulan ng basang ito.
  const { data: worklist } = useQuery({
    queryKey: ['worklist', row.billing_cycle_id],
    queryFn: () => fetchWorklist(row.billing_cycle_id),
  })

  useEffect(() => {
    let active = true
    getSignedPhotoUrl(row.photo_path)
      .then((u) => active && setPhotoUrl(u))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [row.photo_path])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['unassigned'] })
    qc.invalidateQueries({ queryKey: ['worklist', row.billing_cycle_id] })
    qc.invalidateQueries({ queryKey: ['open-worklist'] })
    qc.invalidateQueries({ queryKey: ['cycle-stats'] })
  }

  const mAssign = useMutation({
    mutationFn: () => assignUnassignedReading(row.id, meterId),
    onSuccess: invalidate,
    onError: (e) => onError(e instanceof Error ? e.message : t('common.somethingWrong')),
  })
  const mDiscard = useMutation({
    mutationFn: () => discardUnassignedReading(row.id),
    onSuccess: invalidate,
    onError: (e) => onError(e instanceof Error ? e.message : t('common.somethingWrong')),
  })
  const busy = mAssign.isPending || mDiscard.isPending

  // Tugmang utility lang, at yaong wala pang basa sa cycle na ito —
  // tatanggihan din ito ng RPC, pero mas maganda kung hindi na mapipili.
  const options = useMemo(
    () => (worklist ?? []).filter((m) => m.meter.utility_type === row.utility_type && !m.reading),
    [worklist, row.utility_type],
  )

  return (
    <li className="grid gap-4 p-4 sm:grid-cols-[13rem_1fr] sm:p-5">
      {/* Litrato — nakapirming lapad para pantay-pantay ang mga row */}
      {photoUrl ? (
        <button
          type="button"
          onClick={() => setZoom(true)}
          title={t('readings.viewPhoto')}
          className="group relative overflow-hidden rounded-input border border-slate-200 bg-slate-50"
        >
          <img src={photoUrl} alt="meter" className="h-36 w-full object-contain" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/70 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 className="size-3" />
            {t('readings.viewPhoto')}
          </span>
        </button>
      ) : (
        <div className="flex h-36 items-center justify-center gap-2 rounded-input border border-slate-200 bg-slate-50 text-sm text-slate-400">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={water ? 'info' : 'warning'}>
            <Icon className="mr-1 size-3" />
            {t(water ? 'properties.water' : 'properties.electric')}
          </Badge>
          <span className="text-sm text-slate-600">
            {t('readings.present')}:{' '}
            <span className="tabular font-semibold text-slate-900">{row.present_reading}</span>
          </span>
        </div>

        {row.remarks && <p className="text-sm italic text-slate-500">“{row.remarks}”</p>}

        <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Select
              label={t('readings.assignToMeter')}
              value={meterId}
              onChange={(e) => setMeterId(e.target.value)}
            >
              <option value="">{t('readings.pickProperty')}</option>
              {options.map((m) => (
                <option key={m.meter.id} value={m.meter.id}>
                  {lotLabel(m.property.block, m.property.lot)}
                  {m.ownerName ? ` — ${m.ownerName}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              disabled={busy || !meterId}
              onClick={() => {
                onError(null)
                mAssign.mutate()
              }}
            >
              {t('readings.assignToMeter')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                onError(null)
                mDiscard.mutate()
              }}
              iconLeft={<Trash2 className="size-3.5" />}
            >
              {t('readings.discard')}
            </Button>
          </div>
        </div>
      </div>

      {zoom && photoUrl && (
        <Modal
          open
          onClose={() => setZoom(false)}
          title={t('readings.photo')}
          description={`${t('readings.present')}: ${row.present_reading}`}
          size="lg"
          footer={
            <Button variant="outline" onClick={() => setZoom(false)}>
              {t('common.close')}
            </Button>
          }
        >
          <img
            src={photoUrl}
            alt="meter"
            className="max-h-[70vh] w-full rounded-input object-contain"
          />
        </Modal>
      )}
    </li>
  )
}
