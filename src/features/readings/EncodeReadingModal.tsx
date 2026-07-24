import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle2, Droplets, RefreshCw, Zap } from 'lucide-react'
import {
  createReading,
  getPreviousReading,
  getSignedPhotoUrl,
  uploadMeterPhoto,
} from '@/features/readings/readings-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { consumption as fmtConsumption, meterReading } from '@/lib/format'
import { fileSize } from '@/lib/image'
import type { BillingCycle, WorklistItem } from '@/types/domain'

export function EncodeReadingModal({
  open,
  onClose,
  item,
  cycle,
}: {
  open: boolean
  onClose: () => void
  item: WorklistItem
  cycle: BillingCycle
}) {
  const { t } = useT()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const utility = item.meter.utility_type
  const alreadyRead = Boolean(item.reading)

  const [present, setPresent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'compressing' | 'uploading'>('idle')

  // Naunang reading (RPC)
  const { data: previous } = useQuery({
    queryKey: ['prev-reading', item.meter.id],
    queryFn: () => getPreviousReading(item.meter.id),
    enabled: open && !alreadyRead,
  })
  const prev = alreadyRead ? item.reading!.previous_reading : (previous ?? 0)

  useEffect(() => {
    if (open) {
      setPresent('')
      setFile(null)
      setPreview(null)
      setRemarks('')
      setError(null)
      setPhase('idle')
    }
  }, [open])

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const presentNum = Number(present)
  const cons = present === '' ? null : presentNum - prev
  const isAnomaly = cons !== null && (cons < 0 || cons === 0)

  const save = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error('no-photo')
      setPhase('compressing')
      // (compress happens inside uploadMeterPhoto)
      setPhase('uploading')
      const path = await uploadMeterPhoto(file, cycle.code, item.meter.id)
      await createReading({
        meterId: item.meter.id,
        cycleId: cycle.id,
        present: presentNum,
        photoPath: path,
        remarks,
        readById: user.id,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worklist', cycle.id] })
      onClose()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      setPhase('idle')
      setError(
        /duplicate|unique/i.test(msg)
          ? t('readings.alreadyRead')
          : t('common.somethingWrong'),
      )
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (present === '' || Number.isNaN(presentNum)) return setError(t('common.required'))
    if (!file) return setError(t('readings.photoRequired'))
    if (isAnomaly && !remarks.trim()) return setError(t('readings.remarksRequired'))
    save.mutate()
  }

  const busy = save.isPending
  const Icon = utility === 'water' ? Droplets : Zap

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <Icon className="size-4 text-brand-700" />
          {`Blk ${item.property.block} Lot ${item.property.lot}`}
        </span>
      }
      description={item.ownerName ?? undefined}
      footer={
        alreadyRead ? (
          <Button variant="outline" onClick={onClose}>
            {t('readings.done')}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="reading-form"
              loading={busy}
              disabled={!file}
              iconLeft={<CheckCircle2 className="size-4" />}
            >
              {phase === 'compressing'
                ? t('readings.compressing')
                : phase === 'uploading'
                  ? t('readings.uploading')
                  : t('readings.saveReading')}
            </Button>
          </>
        )
      }
    >
      {alreadyRead ? (
        <ReadingView item={item} />
      ) : (
        <form id="reading-form" onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          {/* Previous (read-only) + Present */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('readings.previous')}
              </label>
              <div className="tabular flex h-11 items-center rounded-input border border-slate-200 bg-slate-50 px-3 font-semibold text-slate-500">
                {meterReading(prev, item.meter.digits)}
              </div>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              label={t('readings.present')}
              placeholder={t('readings.presentPh')}
              required
              value={present}
              onChange={(e) => setPresent(e.target.value)}
              autoFocus
            />
          </div>

          {/* Live consumption */}
          {cons !== null && (
            <div
              className={`flex items-center justify-between rounded-input px-3.5 py-2.5 ${
                isAnomaly
                  ? 'bg-warning-50 ring-1 ring-inset ring-warning-100'
                  : 'bg-brand-50 ring-1 ring-inset ring-brand-100'
              }`}
            >
              <span className="text-sm font-medium text-slate-600">{t('readings.consumption')}</span>
              <span
                className={`tabular text-lg font-bold ${
                  isAnomaly ? 'text-warning-700' : 'text-brand-800'
                }`}
              >
                {fmtConsumption(cons, utility)}
              </span>
            </div>
          )}

          {isAnomaly && <Alert tone="warning">{t('readings.anomalyWarn')}</Alert>}

          {/* Photo — REQUIRED */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('readings.photo')} <span className="text-danger-600">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="relative overflow-hidden rounded-input border border-slate-200">
                <img src={preview} alt="meter" className="max-h-56 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur"
                >
                  <RefreshCw className="size-3.5" />
                  {t('readings.retake')}
                </button>
                {file && (
                  <span className="absolute bottom-2 left-2 rounded bg-slate-900/70 px-2 py-1 text-xs text-white">
                    {fileSize(file.size)}
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-input border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-8 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <Camera className="size-8 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">{t('readings.takePhoto')}</span>
                <span className="text-xs text-slate-400">{t('readings.photoRequired')}</span>
              </button>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('readings.remarks')}
              {isAnomaly && <span className="text-danger-600"> *</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={t('readings.remarksPh')}
              rows={2}
              className="w-full rounded-input border border-slate-300 px-3 py-2 text-slate-900 shadow-xs focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </form>
      )}
    </Modal>
  )
}

/** View mode — kapag nabasa na ang metro ngayong cycle. */
function ReadingView({ item }: { item: WorklistItem }) {
  const { t } = useT()
  const r = item.reading!
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getSignedPhotoUrl(r.photo_path)
      .then((u) => active && setPhotoUrl(u))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [r.photo_path])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label={t('readings.previous')} value={meterReading(r.previous_reading, item.meter.digits)} />
        <Stat label={t('readings.present')} value={meterReading(r.present_reading, item.meter.digits)} />
        <Stat
          label={t('readings.consumption')}
          value={fmtConsumption(r.consumption, item.meter.utility_type)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Badge tone={r.status === 'verified' ? 'success' : r.status === 'for_review' ? 'warning' : 'neutral'}>
          {r.status === 'for_review' ? t('readings.flagged') : r.status}
        </Badge>
        {r.remarks && <p className="text-sm text-slate-500">{r.remarks}</p>}
      </div>

      {photoUrl ? (
        <img src={photoUrl} alt="meter" className="max-h-72 w-full rounded-input border border-slate-200 object-contain" />
      ) : (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      )}
    </div>
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
