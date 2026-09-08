import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Camera, CheckCircle2, Droplets, RefreshCw, Zap } from 'lucide-react'
import {
  createReading,
  createUnassignedReading,
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
import { consumption as fmtConsumption, meterReading, propertyLabel } from '@/lib/format'
import { fileSize } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { UnassignedKind, UtilityType, WorklistItem } from '@/types/domain'

/** Draft kada metro — hindi nawawala kapag lumipat ng tab. */
type Draft = {
  present: string
  /** undefined = hindi pa napupunan mula sa server. */
  previous?: string
  file: File | null
  remarks: string
}
const EMPTY_DRAFT: Draft = { present: '', file: null, remarks: '' }

export function EncodeReadingModal({
  open,
  onClose,
  items,
  cycle,
  picker,
  onSavedAll,
  special,
  heading,
  readOnly = false,
}: {
  open: boolean
  onClose: () => void
  /** Lahat ng aktibong metro ng iisang property (water at/o electric). */
  items: WorklistItem[]
  /** Cycle na pagsasave-an. Galing sa item mismo (isa kada property). */
  cycle: { id: string; code: string }
  /**
   * Opsyonal na pampili ng property, ipinapakita sa itaas ng form.
   * Kapag walang laman ang `items`, ito lang ang lalabas — kaya puwedeng
   * buksan ang modal bago pa may napipiling property (quick encode).
   */
  picker?: ReactNode
  /**
   * Tinatawag kapag tapos na ang LAHAT ng metro ng property. Kapag wala
   * nito, isasara na lang ang modal. Ginagamit ng quick encode para
   * bumalik sa picker at makapagpatuloy sa susunod na bahay.
   */
  onSavedAll?: () => void
  /**
   * Nakatakda kapag "Unknown" o "C.O. Subdivision" ang pinili — walang
   * tunay na metro, kaya sa inbox ng admin napupunta ang basa.
   */
  special?: { kind: UnassignedKind; utility: UtilityType }
  /** Pamagat kapag wala pang napipili (quick encode) — hal. "Water". */
  heading?: string
  /**
   * Saradong cycle — tinitingnan lang. Walang form, walang save; hindi na
   * dapat mabago ang basang naging batayan ng bill na naibayad na.
   */
  readOnly?: boolean
}) {
  const { t } = useT()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'compressing' | 'uploading'>('idle')

  // Nananatili sa hanggahan kahit magbago ang bilang ng metro habang bukas.
  // `null` kapag wala pang napipiling property (quick encode).
  const item = items.length ? items[Math.min(tab, items.length - 1)] : null
  // Walang metro pero may piniling Unknown / C.O. — puwede nang mag-encode.
  const isSpecial = !item && Boolean(special)
  const utility = item?.meter.utility_type ?? special?.utility ?? 'water'
  const alreadyRead = Boolean(item?.reading)

  // Quick encode = may picker sa loob ng form. Iisa lang ang draft dito
  // (walang tabs), kaya hindi nawawala ang litrato kapag nagpalit ng pili.
  const quick = Boolean(picker)
  const draftKey = quick ? 'quick' : (item?.meter.id ?? 'none')
  const draft = drafts[draftKey] ?? EMPTY_DRAFT
  const patch = (p: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [draftKey]: { ...(d[draftKey] ?? EMPTY_DRAFT), ...p } }))

  // Naunang reading (RPC) — kada metro
  const { data: previous } = useQuery({
    queryKey: ['prev-reading', item?.meter.id ?? 'none'],
    queryFn: () => getPreviousReading(item!.meter.id),
    enabled: open && Boolean(item) && !alreadyRead,
  })
  // Hangga't walang na-type ang encoder, ang galing-server na halaga ang
  // ipinapakita. Derived ito — walang effect na puwedeng maunahan ng
  // pag-reset ng form.
  const prevText = draft.previous ?? (previous === undefined ? '' : String(previous))
  // Sadyang binlangko = ang server ang bahala (null ang ipapadala).
  const prevBlank = prevText === ''
  const prev = alreadyRead
    ? item!.reading!.previous_reading
    : prevBlank
      ? (previous ?? 0)
      : Number(prevText)

  // Sa pagbukas AT sa tuwing ibang property ang napili: simulan sa unang
  // metrong hindi pa nababasa, at linisin ang mga draft.
  const propertyKey = items[0]?.property.id ?? special?.kind ?? ''
  useEffect(() => {
    if (!open) return
    const firstUnread = items.findIndex((i) => !i.reading)
    setTab(firstUnread >= 0 ? firstUnread : 0)
    setDrafts({})
    setPreview(null)
    setError(null)
    setPhase('idle')
    // Sa pagbukas at paglipat ng property lang — hindi sa bawat refetch ng
    // worklist, dahil mabubura niyon ang kalahating na-type na draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quick ? 'quick' : propertyKey])

  useEffect(() => {
    if (!draft.file) return setPreview(null)
    const url = URL.createObjectURL(draft.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [draft.file])

  const presentNum = Number(draft.present)
  const cons =
    draft.present === '' || (isSpecial && prevBlank) ? null : presentNum - prev
  const isAnomaly = cons !== null && (cons < 0 || cons === 0)

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.file || !user || (!item && !special)) throw new Error('no-photo')
      setPhase('compressing')
      // (compress happens inside uploadMeterPhoto)
      setPhase('uploading')
      const folder = item ? item.meter.id : `unassigned/${special!.kind}`
      const path = await uploadMeterPhoto(draft.file, cycle.code, folder)

      if (!item) {
        // Walang metro — sa inbox ng admin ito papasok, hindi bill.
        await createUnassignedReading({
          cycleId: cycle.id,
          kind: special!.kind,
          utility: special!.utility,
          previous: prevBlank ? null : Number(prevText),
          present: presentNum,
          photoPath: path,
          remarks: draft.remarks,
          readById: user.id,
        })
        return
      }

      await createReading({
        meterId: item.meter.id,
        cycleId: cycle.id,
        present: presentNum,
        previous: prevBlank ? null : Number(prevText),
        photoPath: path,
        remarks: draft.remarks,
        readById: user.id,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worklist', cycle.id] })
      qc.invalidateQueries({ queryKey: ['open-worklist'] })
      qc.invalidateQueries({ queryKey: ['property-readings'] })
      // Kung sa inbox ng admin ito napunta, i-refresh din ang bilang doon.
      if (!item) qc.invalidateQueries({ queryKey: ['unassigned'] })
      setPhase('idle')
      setError(null)
      // Dumiretso sa susunod na metrong hindi pa nababasa; kung wala na, isara.
      const next = items.findIndex((i, idx) => idx !== tab && !i.reading)
      if (next >= 0) setTab(next)
      else if (onSavedAll) onSavedAll()
      else onClose()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      setPhase('idle')
      setError(/duplicate|unique/i.test(msg) ? t('readings.alreadyRead') : t('common.somethingWrong'))
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // Sa quick encode, walang mapagsusumite kung wala pang napiling property.
    if (!item && !special) return setError(t('readings.pickPropertyHint'))
    if (draft.present === '' || Number.isNaN(presentNum)) return setError(t('common.required'))
    if (!draft.file) return setError(t('readings.photoRequired'))
    if (isAnomaly && !draft.remarks.trim()) return setError(t('readings.remarksRequired'))
    save.mutate()
  }

  const busy = save.isPending
  const allRead = items.every((i) => i.reading)

  // Iisang kahon ng litrato (REQUIRED), ibang pwesto lang sa dalawang mode.
  const photoField = (
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
        onChange={(e) => patch({ file: e.target.files?.[0] ?? null })}
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
          {draft.file && (
            <span className="absolute bottom-2 left-2 rounded bg-slate-900/70 px-2 py-1 text-xs text-white">
        {fileSize(draft.file.size)}
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
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        item
          ? propertyLabel(item.property)
          : special
            ? t(special.kind === 'unknown' ? 'readings.unknownProperty' : 'readings.coSubdivision')
            : (heading ?? t('readings.pickProperty'))
      }
      description={item?.ownerName ?? undefined}
      footer={
        readOnly ? (
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        ) : !item && !isSpecial && !quick ? (
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        ) : alreadyRead ? (
          <Button variant="outline" onClick={onClose}>
            {allRead ? t('readings.done') : t('common.close')}
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
              disabled={!draft.file || (!item && !special)}
              iconLeft={<CheckCircle2 className="size-4" />}
            >
              {phase === 'compressing'
                ? t('readings.compressing')
                : phase === 'uploading'
                  ? t('readings.uploading')
                  : t('readings.submitReading')}
            </Button>
          </>
        )
      }
    >
      {/* Sa quick mode, nasa loob ng form ang picker — dito ito lumalabas
          kapag nabasa na (ReadingView) para makapagpalit pa rin. */}
      {picker && alreadyRead && <div className="mb-4">{picker}</div>}

      {/* Tabs — isa kada metro (Water / Electric) */}
      {items.length > 1 && (
        <div className="mb-4 flex gap-1.5">
          {items.map((i, idx) => {
            const water = i.meter.utility_type === 'water'
            const Icon = water ? Droplets : Zap
            return (
              <button
                key={i.meter.id}
                type="button"
                onClick={() => {
                  setTab(idx)
                  setError(null)
                }}
                disabled={busy}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                  idx === tab
                    ? 'bg-brand-700 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
                )}
              >
                <Icon className="size-4" />
                {water ? t('properties.water') : t('properties.electric')}
                {i.reading &&
                  (i.reading.status === 'for_review' ? (
                    <AlertTriangle
                      className={cn('size-3.5', idx === tab ? 'text-white' : 'text-warning-600')}
                    />
                  ) : (
                    <CheckCircle2
                      className={cn('size-3.5', idx === tab ? 'text-white' : 'text-success-600')}
                    />
                  ))}
              </button>
            )
          })}
        </div>
      )}

      {readOnly ? (
        item?.reading ? (
          <ReadingView item={item} />
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">{t('readings.notRead')}</p>
        )
      ) : !item && !isSpecial && !quick ? (
        <p className="py-6 text-center text-sm text-slate-400">{t('readings.pickPropertyHint')}</p>
      ) : alreadyRead && item ? (
        <ReadingView item={item} />
      ) : (
        <form id="reading-form" onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          {/* Quick encode: kuhanan muna ng litrato, tapos piliin kung
              kaninong metro ito. Parehong required bago makapag-submit. */}
          {quick && (
            <>
              {photoField}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('readings.pickProperty')} <span className="text-danger-600">*</span>
                </label>
                {picker}
              </div>
            </>
          )}

          {/* Walang metro — paalala kung saan ito mapupunta, at ang serial
              na nabasa (malaking tulong sa admin sa pagtukoy). */}
          {isSpecial && <Alert tone="info">{t('readings.savedForAdmin')}</Alert>}

          {/* Previous (na-e-edit) + Present.
              Sa Unknown / C.O. ay walang Previous — hindi pa alam kung
              aling metro ito, kaya walang mapagbabatayan. */}
          <div className={isSpecial ? '' : 'grid grid-cols-2 gap-3'}>
            {!isSpecial && (
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                label={t('readings.previous')}
                value={prevText}
                onChange={(e) => patch({ previous: e.target.value })}
              />
            )}
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              label={t('readings.present')}
              placeholder={t('readings.presentPh')}
              required
              value={draft.present}
              onChange={(e) => patch({ present: e.target.value })}
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

          {!quick && photoField}

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('readings.remarks')}
              {isAnomaly && <span className="text-danger-600"> *</span>}
            </label>
            <textarea
              value={draft.remarks}
              onChange={(e) => patch({ remarks: e.target.value })}
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
    setPhotoUrl(null)
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
