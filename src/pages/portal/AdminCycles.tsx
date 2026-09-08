import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  ArrowLeft,
  ChevronRight,
  Droplets,
  FileText,
  HelpCircle,
  Plus,
  Receipt,
  Search,
  Send,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { CycleFormModal } from '@/features/readings/CycleFormModal'
import { UnassignedTab } from '@/features/readings/UnassignedTab'
import { fetchProperties } from '@/features/properties/properties-api'
import {
  BillBreakdown,
  BillReadingDetail,
  PropertyBillHistory,
} from '@/features/billing/BillReadingDetail'
import {
  deleteCycle,
  fetchCycles,
  fetchPendingUnassignedCounts,
} from '@/features/readings/readings-api'
import {
  applyPenalties,
  fetchBillsForCycle,
  fetchCycleStats,
  generateBills,
  releaseBills,
} from '@/features/billing/billing-api'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { lotLabel, money, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { BillingCycle, BillStatus, CycleStatus, UnassignedKind } from '@/types/domain'

const TONE: Record<CycleStatus, BadgeTone> = {
  open: 'success',
  reading: 'info',
  billed: 'warning',
  closed: 'neutral',
}
const STATUS_TABS: ('all' | CycleStatus)[] = ['all', 'open', 'reading', 'billed', 'closed']
/** Dagdag na tab page — ang mga basang walang property. */
const KIND_TABS: UnassignedKind[] = ['unknown', 'co_subdivision']
const KIND_LABEL: Record<UnassignedKind, string> = {
  unknown: 'readings.unknownProperty',
  co_subdivision: 'readings.coSubdivision',
}
type Tab = 'all' | CycleStatus | UnassignedKind
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
  const [viewBills, setViewBills] = useState<BillingCycle | null>(null)
  const [confirm, setConfirm] = useState<{
    kind: 'delete' | 'release'
    id: string
    code: string
    /** Ilang draft bill ang ilalabas — ipinapakita sa confirm. */
    count?: number
  } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['cycles'], queryFn: fetchCycles })
  const cycles = data ?? []
  const { data: statsMap } = useQuery({ queryKey: ['cycle-stats'], queryFn: fetchCycleStats })
  // Bilang ng basang walang property na naghihintay ng aksyon ng admin.
  const { data: unassignedMap } = useQuery({
    queryKey: ['unassigned', 'counts'],
    queryFn: fetchPendingUnassignedCounts,
  })
  const kindTotals = KIND_TABS.reduce(
    (acc, k) => {
      acc[k] = Object.values(unassignedMap ?? {}).reduce((n, c) => n + c[k], 0)
      return acc
    },
    { unknown: 0, co_subdivision: 0 } as Record<UnassignedKind, number>,
  )
  const [tab, setTab] = useState<Tab>('all')
  // Isang cycle = isang property, kaya pumipili muna ng homeowner bago
  // makita ang cycles niya.
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [propSearch, setPropSearch] = useState('')
  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })
  const kindTab = KIND_TABS.find((k) => k === tab) ?? null
  const byProperty = propertyId ? cycles.filter((c) => c.property_id === propertyId) : cycles
  const filtered =
    tab === 'all' || kindTab ? byProperty : byProperty.filter((c) => c.status === tab)

  const selectedProperty = (properties ?? []).find((p) => p.id === propertyId) ?? null
  const ownerOf = (p: { owners?: { end_date: string | null; profile: { full_name: string } | null }[] }) =>
    p.owners?.find((o) => !o.end_date)?.profile?.full_name ?? null

  const propQ = propSearch.trim().toLowerCase()
  const propRows = (properties ?? []).filter((p) =>
    !propQ
      ? true
      : `${lotLabel(p.block, p.lot)} ${ownerOf(p) ?? ''}`.toLowerCase().includes(propQ),
  )

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cycles'] })
    qc.invalidateQueries({ queryKey: ['bills'] })
    qc.invalidateQueries({ queryKey: ['cycle-stats'] })
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
      setConfirm(null)
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
  const mDel = useMutation({
    mutationFn: deleteCycle,
    onSuccess: () => {
      setNote(t('readings.cycleDeleted'))
      setConfirm(null)
      invalidate()
    },
  })

  const busy = mGen.isPending || mRel.isPending || mPen.isPending || mDel.isPending

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

      {propertyId && !kindTab && selectedProperty && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => setPropertyId(null)}
              className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              {t('readings.backToProperties')}
            </button>
            <p className="text-lg font-semibold text-slate-900">
              {lotLabel(selectedProperty.block, selectedProperty.lot)}
            </p>
            <p className="text-sm text-slate-500">{ownerOf(selectedProperty) ?? '—'}</p>
          </div>
        </div>
      )}

      {/* Status tabs — para sa cycles ng napiling homeowner */}
      {!isLoading && propertyId && !kindTab && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                tab === s
                  ? 'bg-brand-700 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
              )}
            >
              {s === 'all' ? t('accounts.filterAll') : t(`readings.status${cap(s)}`)}
            </button>
          ))}
        </div>
      )}

      {/* Unknown / C.O. — hindi pag-aari ng kahit sinong homeowner, kaya
          nasa labas ito at laging maaabot. */}
      {!isLoading && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {kindTab && (
            <button
              type="button"
              onClick={() => setTab('all')}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5" />
              {t('readings.backToProperties')}
            </button>
          )}
          {KIND_TABS.map((k) => {
            const n = kindTotals[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === k
                    ? 'bg-brand-700 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
                )}
              >
                <HelpCircle className="size-3.5" />
                {n > 0 ? `${t(KIND_LABEL[k])} (${n})` : t(KIND_LABEL[k])}
              </button>
            )
          })}
        </div>
      )}

      {kindTab ? (
        <UnassignedTab kind={kindTab} />
      ) : !propertyId ? (
        /* Hakbang 1 — pumili ng homeowner */
        <>
          <div className="mb-3 sm:max-w-sm">
            <Input
              placeholder={t('readings.searchProperty')}
              iconLeft={<Search className="size-4" />}
              value={propSearch}
              onChange={(e) => setPropSearch(e.target.value)}
            />
          </div>
          <Card>
            {propRows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">{t('readings.noMatches')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {propRows.map((p) => {
                  const mine = cycles.filter((c) => c.property_id === p.id)
                  // Ang pinakabago: ang bukas na cycle kung meron, kung wala
                  // ang huling ginawa (naka-sort na by code, pababa).
                  const latest =
                    mine.find((c) => c.status === 'open' || c.status === 'reading') ?? mine[0] ?? null
                  const ls = latest ? statsMap?.[latest.id] : undefined
                  const encoded = (ls?.verified ?? 0) + (ls?.forReview ?? 0) > 0
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPropertyId(p.id)}
                        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:flex-nowrap sm:px-5"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                          <CalendarClock className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="truncate font-semibold text-slate-900">
                            {lotLabel(p.block, p.lot)}
                          </p>
                          <p className="truncate text-sm text-slate-500">{ownerOf(p) ?? '—'}</p>
                        </div>
                        {/* Sa mobile, sariling linya ang badges — kung hindi,
                            napipiga ang pangalan hanggang sa mag-isang letra. */}
                        <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                          {latest?.due_date ? (
                            <Badge tone="info">
                              {`${t('billing.nextBilling')}: ${shortDate(latest.due_date)}`}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">{t('billing.noNextBilling')}</Badge>
                          )}
                          {latest && (
                            <Badge tone={encoded ? 'success' : 'warning'}>
                              {encoded ? t('readings.encodedTag') : t('readings.notEncodedTag')}
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="hidden size-5 shrink-0 text-slate-300 sm:block" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      ) : (
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : cycles.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<CalendarClock className="size-6" />} title={t('readings.noCycles')} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{t('readings.noneForStatus')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => {
              const s = statsMap?.[c.id] ?? {
                verified: 0,
                verifiedWater: 0,
                verifiedElectric: 0,
                forReview: 0,
                draftBills: 0,
                generatable: 0,
                releasedBills: 0,
                paidBills: 0,
              }
              const isClosed = c.status === 'closed'
              // May basa pero WALA pang bill — iyon lang ang magagawan ng
              // generate_bills. Kapag nagawa na lahat, walang bubuoin kahit
              // pindutin pa, kaya patay ang button.
              const canGenerate = s.generatable > 0
              const canRelease = s.draftBills > 0
              const pending = unassignedMap?.[c.id] ?? {
                unknown: 0,
                co_subdivision: 0,
                total: 0,
              }
              // Dalawang magkaibang bagay: may HUMAHARANG ba (warning), o
              // tapos na lang talaga (walang dapat ipag-alala).
              const genHint =
                canGenerate || isClosed || s.verified > 0
                  ? null
                  : s.forReview > 0
                    ? t('billing.needVerify')
                    : t('billing.needReading')
              const genDone = !canGenerate && !isClosed && s.verified > 0
              return (
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
                    {/* Kanino ang cycle na ito */}
                    <p className="text-xs font-medium text-slate-600">
                      {c.property
                        ? `${lotLabel(c.property.block, c.property.lot)}${c.ownerName ? ` — ${c.ownerName}` : ''}`
                        : t('readings.allProperties')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.due_date ? `${t('billing.dueDate')}: ${shortDate(c.due_date)}` : '—'}
                    </p>

                    {/* Ano na ang meron sa cycle na ito — kita kahit Open pa */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {s.verifiedWater > 0 && (
                        <Badge tone="info">
                          <Droplets className="mr-1 size-3" />
                          {`${t('properties.water')}: ${s.verifiedWater}`}
                        </Badge>
                      )}
                      {s.verifiedElectric > 0 && (
                        <Badge tone="warning">
                          <Zap className="mr-1 size-3" />
                          {`${t('properties.electric')}: ${s.verifiedElectric}`}
                        </Badge>
                      )}
                      {s.forReview > 0 && (
                        <Badge tone="warning">{`${t('billing.tagForReview')}: ${s.forReview}`}</Badge>
                      )}
                      {s.draftBills > 0 && (
                        <Badge tone="neutral">{`${t('billing.tagDraftBills')}: ${s.draftBills}`}</Badge>
                      )}
                      {s.releasedBills > 0 && (
                        <Badge tone="info">{`${t('billing.tagReleased')}: ${s.releasedBills}`}</Badge>
                      )}
                      {s.paidBills > 0 && (
                        <Badge tone="success">{`${t('billing.tagPaidBills')}: ${s.paidBills}`}</Badge>
                      )}
                      {s.verified === 0 &&
                        s.forReview === 0 &&
                        s.draftBills === 0 &&
                        s.releasedBills === 0 &&
                        s.paidBills === 0 && (
                          <span className="text-xs text-slate-400">{t('billing.tagNothingYet')}</span>
                        )}
                    </div>
                    {pending.total > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning-700">
                        <HelpCircle className="size-3.5 shrink-0" />
                        {[
                          pending.unknown > 0
                            ? `${t('readings.unknownProperty')}: ${pending.unknown}`
                            : null,
                          pending.co_subdivision > 0
                            ? `${t('readings.coSubdivision')}: ${pending.co_subdivision}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {genHint && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
                        <TriangleAlert className="size-3.5 shrink-0" />
                        {genHint}
                      </p>
                    )}
                    {genDone && (
                      <p className="mt-0.5 text-xs text-slate-400">{t('billing.allGenerated')}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isClosed && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !canGenerate}
                        title={genHint ?? (genDone ? t('billing.allGenerated') : undefined)}
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
                        disabled={busy || !canRelease}
                        title={!canRelease ? t('billing.needGenerate') : undefined}
                        onClick={() =>
                          setConfirm({
                            kind: 'release',
                            id: c.id,
                            code: c.code,
                            count: s.draftBills,
                          })
                        }
                        iconLeft={<Send className="size-3.5" />}
                      >
                        {t('billing.release')}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewBills(c)}
                    iconLeft={<FileText className="size-3.5" />}
                  >
                    {t('billing.viewBills')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setConfirm({ kind: 'delete', id: c.id, code: c.code })}
                    iconLeft={<Trash2 className="size-3.5" />}
                  >
                    {t('readings.deleteCycle')}
                  </Button>
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </Card>
      )}

      <CycleFormModal open={open} onClose={() => setOpen(false)} propertyId={propertyId} />
      {viewBills && (
        <BillsModal cycle={viewBills} onClose={() => setViewBills(null)} billTone={BILL_TONE} />
      )}
      {confirm && (
        <ConfirmDialog
          open
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setNote(null)
            if (confirm.kind === 'delete') mDel.mutate(confirm.id)
            else mRel.mutate(confirm.id)
          }}
          title={
            confirm.kind === 'delete'
              ? t('readings.deleteCycleTitle').replace('{code}', confirm.code)
              : `${t('billing.releaseTitle')} · ${confirm.code}`
          }
          message={
            confirm.kind === 'delete' ? (
              t('readings.confirmDeleteCycle')
            ) : (
              <>
                {/* span, hindi p — nasa loob na ito ng <p> ng ConfirmDialog */}
                <span className="block">
                  {t('billing.confirmReleaseCount').replace('{n}', String(confirm.count ?? 0))}
                </span>
                <span className="mt-2 block text-slate-500">
                  {t('billing.confirmReleaseNote')}
                </span>
              </>
            )
          }
          confirmLabel={confirm.kind === 'delete' ? t('readings.deleteCycle') : t('billing.release')}
          cancelLabel={t('common.cancel')}
          danger={confirm.kind === 'delete'}
          loading={confirm.kind === 'delete' ? mDel.isPending : mRel.isPending}
        />
      )}
    </AppShell>
  )
}

function BillsModal({
  cycle,
  onClose,
  billTone,
}: {
  cycle: BillingCycle
  onClose: () => void
  billTone: Record<BillStatus, BadgeTone>
}) {
  const { t } = useT()
  // Alin sa mga bill ang nakabukas — dito lumalabas ang basa at litrato.
  const [openBill, setOpenBill] = useState<string | null>(null)
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
      description={[
        `${bills.length} ${t('billing.billCount')}`,
        `${t('billing.totalBilled')}: ${money(total)}`,
        period(cycle, t) ?? null,
      ]
        .filter(Boolean)
        .join(' · ')}
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
          {bills.map((b) => {
            const expanded = openBill === b.id
            return (
              <li key={b.id} className="py-1">
                <button
                  type="button"
                  onClick={() => setOpenBill(expanded ? null : b.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-input px-1 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
                    <ChevronRight
                      className={cn(
                        'size-4 shrink-0 text-slate-400 transition-transform',
                        expanded && 'rotate-90',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        Blk {b.property?.block} Lot {b.property?.lot}
                      </p>
                      <p className="text-xs text-slate-400">{b.bill_no}</p>
                      {period(cycle, t) && (
                        <p className="text-xs text-slate-500">{period(cycle, t)}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold text-slate-900">
                      {money(b.total_amount)}
                    </p>
                    <Badge tone={billTone[b.status]}>{t(`billing.st_${b.status}`)}</Badge>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-3 px-1 pb-3 pt-1">
                    <BillBreakdown bill={b} />
                    <BillReadingDetail items={b.items ?? []} />

                    {/* Buwan-buwang kasaysayan ng property na ito */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('billing.historyTitle')}
                      </p>
                      <PropertyBillHistory propertyId={b.property_id} currentBillId={b.id} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

/**
 * Anong panahon ang sinisingil — ang reading window ng cycle. Kapag walang
 * nakatakdang petsa, ang due date na lang ang sinasabi.
 */
function period(c: BillingCycle, t: (k: string) => string): string | null {
  if (c.reading_start && c.reading_end) {
    return `${t('billing.periodCovered')}: ${shortDate(c.reading_start)} – ${shortDate(c.reading_end)}`
  }
  if (c.reading_start) return `${t('billing.periodCovered')}: ${shortDate(c.reading_start)} –`
  if (c.due_date) return `${t('billing.dueDate')}: ${shortDate(c.due_date)}`
  return null
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
