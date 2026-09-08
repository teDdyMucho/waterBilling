import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Droplets, Search, Zap } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { EncodeReadingModal } from '@/features/readings/EncodeReadingModal'
import { fetchPropertyReadings } from '@/features/readings/readings-api'
import { fetchProperties } from '@/features/properties/properties-api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { PropertyWithRelations, WorklistItem } from '@/types/domain'

/** Water muna bago electric — pare-pareho ang ayos sa buong app. */
function byUtility(a: WorklistItem, b: WorklistItem) {
  return a.meter.utility_type === b.meter.utility_type ? 0 : a.meter.utility_type === 'water' ? -1 : 1
}

function ownerOf(p: PropertyWithRelations) {
  return p.owners?.find((o) => !o.end_date)?.profile?.full_name ?? null
}

export default function StaffWorklist() {
  const { t } = useT()
  // Hakbang 1: pumili ng homeowner. Hakbang 2: ang buong kasaysayan niya.
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null)

  const { data: properties, isLoading: propsLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProperties,
  })

  const { data: groups, isLoading } = useQuery({
    queryKey: ['property-readings', propertyId],
    queryFn: () => fetchPropertyReadings(propertyId!),
    enabled: Boolean(propertyId),
  })

  const selected = (properties ?? []).find((p) => p.id === propertyId) ?? null
  const rows = groups ?? []

  const q = search.trim().toLowerCase()
  const propRows = (properties ?? []).filter((p) =>
    !q ? true : `${lotLabel(p.block, p.lot)} ${ownerOf(p) ?? ''}`.toLowerCase().includes(q),
  )

  // Ang binuksang cycle sa modal.
  const activeGroup = rows.find((x) => x.cycle.id === activeCycleId) ?? null
  const activeEditable =
    activeGroup?.cycle.status === 'open' || activeGroup?.cycle.status === 'reading'
  const activeItems = useMemo(
    () => (activeGroup ? [...activeGroup.items].sort(byUtility) : []),
    [activeGroup],
  )

  // ------------------------------------------------------------------
  //  Hakbang 1 — listahan ng homeowner
  // ------------------------------------------------------------------
  if (!propertyId) {
    return (
      <AppShell>
        <PageHeader title={t('readings.worklistTitle')} description={t('readings.worklistSub')} />

        <div className="mb-3 sm:max-w-sm">
          <Input
            placeholder={t('readings.searchProperty')}
            iconLeft={<Search className="size-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {propsLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : (
          <Card>
            {propRows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">{t('readings.noMatches')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {propRows.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPropertyId(p.id)}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:flex-nowrap sm:px-5"
                    >
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate font-semibold text-slate-900">
                          {lotLabel(p.block, p.lot)}
                        </p>
                        <p className="truncate text-sm text-slate-500">{ownerOf(p) ?? '—'}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {p.meters
                          ?.filter((m) => m.status === 'active')
                          .map((m) => {
                            const water = m.utility_type === 'water'
                            const Icon = water ? Droplets : Zap
                            return (
                              <span
                                key={m.id}
                                title={water ? t('properties.water') : t('properties.electric')}
                                className={cn(
                                  'grid size-6 place-items-center rounded-md ring-1 ring-inset',
                                  water
                                    ? 'bg-water-50 text-water-700 ring-water-100'
                                    : 'bg-power-50 text-power-700 ring-power-100',
                                )}
                              >
                                <Icon className="size-3.5" />
                              </span>
                            )
                          })}
                      </div>
                      <ChevronRight className="hidden size-5 shrink-0 text-slate-300 sm:block" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </AppShell>
    )
  }

  // ------------------------------------------------------------------
  //  Hakbang 2 — buong kasaysayan ng napiling homeowner
  // ------------------------------------------------------------------
  return (
    <AppShell>
      <PageHeader title={t('readings.worklistTitle')} description={t('readings.worklistSub')} />

      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setPropertyId(null)
            setActiveCycleId(null)
          }}
          className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          {t('readings.backToProperties')}
        </button>
        {selected && (
          <>
            <p className="text-lg font-semibold text-slate-900">
              {lotLabel(selected.block, selected.lot)}
            </p>
            <p className="text-sm text-slate-500">{ownerOf(selected) ?? '—'}</p>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : rows.length === 0 ? (
        <Alert tone="info">{t('readings.noActiveCycle')}</Alert>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {rows.map((g) => {
              // Bukas = puwedeng i-encode. Sarado = matitingnan pa rin —
              // nandoon ang litrato at ang basang naging batayan ng bill.
              const editable = g.cycle.status === 'open' || g.cycle.status === 'reading'
              const items = [...g.items].sort(byUtility)
              const statusKey = `readings.status${g.cycle.status.charAt(0).toUpperCase()}${g.cycle.status.slice(1)}`
              return (
                <li key={g.cycle.id}>
                  <button
                    type="button"
                    onClick={() => setActiveCycleId(g.cycle.id)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:flex-nowrap sm:px-5"
                  >
                    <div className="min-w-0 flex-1 basis-44">
                      <p className="truncate font-semibold text-slate-900">{g.cycle.code}</p>
                      <p className="text-xs text-slate-500">{t(statusKey)}</p>
                    </div>

                    {/* Isang chip kada metro — kita agad ang kulang */}
                    <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                      {items.map((i) => {
                        const water = i.meter.utility_type === 'water'
                        const Icon = water ? Droplets : Zap
                        const r = i.reading
                        const tone = r
                          ? r.status === 'for_review'
                            ? 'warning'
                            : 'success'
                          : 'neutral'
                        const label = r
                          ? r.status === 'for_review'
                            ? t('readings.flagged')
                            : t('readings.done')
                          : editable
                            ? t('readings.encode')
                            : t('readings.notRead')
                        return (
                          <Badge key={i.meter.id} tone={tone}>
                            <Icon className="mr-1 size-3" />
                            {label}
                          </Badge>
                        )
                      })}
                    </div>
                    <ChevronRight className="hidden size-5 shrink-0 text-slate-300 sm:block" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {activeItems.length > 0 && (
        <EncodeReadingModal
          open
          onClose={() => setActiveCycleId(null)}
          items={activeItems}
          cycle={activeItems[0].cycle}
          readOnly={!activeEditable}
        />
      )}
    </AppShell>
  )
}
