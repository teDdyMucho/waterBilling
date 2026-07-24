import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Search,
  Zap,
} from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { EncodeReadingModal } from '@/features/readings/EncodeReadingModal'
import { fetchActiveCycle, fetchWorklist } from '@/features/readings/readings-api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { WorklistItem } from '@/types/domain'

type Filter = 'all' | 'unread' | 'done' | 'flagged'

export default function StaffWorklist() {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [active, setActive] = useState<WorklistItem | null>(null)

  const { data: cycle, isLoading: cycleLoading } = useQuery({
    queryKey: ['active-cycle'],
    queryFn: fetchActiveCycle,
  })
  const { data: items, isLoading } = useQuery({
    queryKey: ['worklist', cycle?.id],
    queryFn: () => fetchWorklist(cycle!.id),
    enabled: Boolean(cycle?.id),
  })

  const list = items ?? []
  const done = list.filter((i) => i.reading).length
  const total = list.length
  const pct = total ? Math.round((done / total) * 100) : 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((i) => {
      if (filter === 'unread' && i.reading) return false
      if (filter === 'done' && (!i.reading || i.reading.status === 'for_review')) return false
      if (filter === 'flagged' && i.reading?.status !== 'for_review') return false
      if (!q) return true
      return (
        `${i.property.block} ${i.property.lot}`.toLowerCase().includes(q) ||
        (i.ownerName ?? '').toLowerCase().includes(q)
      )
    })
  }, [list, search, filter])

  // Grupo ayon sa block
  const groups = useMemo(() => {
    const map = new Map<string, WorklistItem[]>()
    for (const i of filtered) {
      const k = i.property.block
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(i)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const filters: Filter[] = ['all', 'unread', 'done', 'flagged']

  if (cycleLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      </AppShell>
    )
  }

  if (!cycle) {
    return (
      <AppShell>
        <PageHeader title={t('readings.worklistTitle')} description={t('readings.worklistSub')} />
        <Alert tone="info">{t('readings.noActiveCycle')}</Alert>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        title={t('readings.worklistTitle')}
        description={t('readings.worklistSub')}
        action={<Badge tone="info">{`${t('readings.activeCycle')}: ${cycle.code}`}</Badge>}
      />

      {/* Progress */}
      <Card className="mb-4 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {t('readings.progress').replace('{done}', String(done)).replace('{total}', String(total))}
          </span>
          <span className="tabular font-semibold text-brand-700">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 sm:max-w-xs">
          <Input
            placeholder={t('readings.searchWorklist')}
            iconLeft={<Search className="size-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-brand-700 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
              )}
            >
              {t(`readings.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([block, rows]) => (
            <div key={block}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Block {block}
              </p>
              <Card>
                <ul className="divide-y divide-slate-100">
                  {rows.map((i) => (
                    <WorklistRow key={i.meter.id} item={i} onOpen={() => setActive(i)} />
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}

      {active && (
        <EncodeReadingModal open onClose={() => setActive(null)} item={active} cycle={cycle} />
      )}
    </AppShell>
  )
}

function WorklistRow({ item, onOpen }: { item: WorklistItem; onOpen: () => void }) {
  const { t } = useT()
  const isWater = item.meter.utility_type === 'water'
  const Icon = isWater ? Droplets : Zap
  const r = item.reading

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-5"
      >
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset',
            isWater ? 'bg-water-50 text-water-700 ring-water-100' : 'bg-power-50 text-power-700 ring-power-100',
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{lotLabel(item.property.block, item.property.lot)}</p>
          <p className="truncate text-sm text-slate-500">
            {item.ownerName ?? '—'} · {isWater ? t('properties.water') : t('properties.electric')}
          </p>
        </div>

        {r ? (
          r.status === 'for_review' ? (
            <Badge tone="warning">
              <AlertTriangle className="mr-1 size-3" />
              {t('readings.flagged')}
            </Badge>
          ) : (
            <Badge tone="success">
              <CheckCircle2 className="mr-1 size-3" />
              {t('readings.done')}
            </Badge>
          )
        ) : (
          <Badge tone="neutral">{t('readings.encode')}</Badge>
        )}
        <ChevronRight className="size-5 shrink-0 text-slate-300" />
      </button>
    </li>
  )
}
