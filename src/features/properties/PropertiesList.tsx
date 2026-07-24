import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, Droplets, Plus, Search, Upload, Zap } from 'lucide-react'
import { fetchProperties } from '@/features/properties/properties-api'
import { PropertyFormModal } from '@/features/properties/PropertyFormModal'
import { ImportCsvModal } from '@/features/properties/ImportCsvModal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { PropertyStatus, PropertyWithRelations } from '@/types/domain'

const STATUS_TONE: Record<PropertyStatus, BadgeTone> = {
  occupied: 'success',
  vacant: 'warning',
  inactive: 'neutral',
}

export function PropertiesList({ basePath }: { basePath: string }) {
  const { t } = useT()
  const navigate = useNavigate()
  const readOnly = !basePath.startsWith('/admin')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PropertyStatus>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })

  const rows = useMemo(() => {
    const list = data ?? []
    const q = search.trim().toLowerCase()
    return list.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!q) return true
      const owner = p.owners?.find((o) => !o.end_date)?.profile?.full_name ?? ''
      return (
        `${p.block} ${p.lot} ${p.phase ?? ''}`.toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q)
      )
    })
  }, [data, search, statusFilter])

  const statuses: ('all' | PropertyStatus)[] = ['all', 'occupied', 'vacant', 'inactive']

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 sm:max-w-xs">
          <Input
            placeholder={t('properties.search')}
            iconLeft={<Search className="size-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              iconLeft={<Upload className="size-4" />}
            >
              {t('properties.import')}
            </Button>
            <Button onClick={() => setAddOpen(true)} iconLeft={<Plus className="size-4" />}>
              {t('properties.add')}
            </Button>
          </div>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === s
                ? 'bg-brand-700 text-white'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
            )}
          >
            {s === 'all' ? t('accounts.filterAll') : t(`properties.${s}`)}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Building2 className="size-6" />}
              title={t('properties.noProperties')}
              action={
                !readOnly ? (
                  <Button onClick={() => setAddOpen(true)} iconLeft={<Plus className="size-4" />}>
                    {t('properties.add')}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => (
              <PropertyRow
                key={p.id}
                property={p}
                onClick={() => navigate(`${basePath}/${p.id}`)}
              />
            ))}
          </ul>
        )}
      </Card>

      {!readOnly && (
        <>
          <PropertyFormModal open={addOpen} onClose={() => setAddOpen(false)} />
          <ImportCsvModal open={importOpen} onClose={() => setImportOpen(false)} />
        </>
      )}
    </>
  )

  function PropertyRow({
    property: p,
    onClick,
  }: {
    property: PropertyWithRelations
    onClick: () => void
  }) {
    const owner = p.owners?.find((o) => !o.end_date)?.profile?.full_name
    const water = p.meters?.some((m) => m.utility_type === 'water' && m.status === 'active')
    const electric = p.meters?.some((m) => m.utility_type === 'electric' && m.status === 'active')

    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <Building2 className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">
              {lotLabel(p.block, p.lot)}
              {p.phase && <span className="ml-1.5 text-slate-400">· {p.phase}</span>}
            </p>
            <p className="truncate text-sm text-slate-500">
              {owner ?? <span className="italic text-slate-400">{t('properties.noOwner')}</span>}
            </p>
          </div>

          {/* Meter indicators */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <MeterDot on={water} icon={<Droplets className="size-3.5" />} tone="water" />
            <MeterDot on={electric} icon={<Zap className="size-3.5" />} tone="power" />
          </div>

          <Badge tone={STATUS_TONE[p.status]} className="hidden sm:inline-flex">
            {t(`properties.${p.status}`)}
          </Badge>

          <ChevronRight className="size-5 shrink-0 text-slate-300" />
        </button>
      </li>
    )
  }
}

function MeterDot({
  on,
  icon,
  tone,
}: {
  on: boolean
  icon: React.ReactNode
  tone: 'water' | 'power'
}) {
  return (
    <span
      className={cn(
        'grid size-7 place-items-center rounded-lg ring-1 ring-inset',
        on
          ? tone === 'water'
            ? 'bg-water-50 text-water-700 ring-water-100'
            : 'bg-power-50 text-power-700 ring-power-100'
          : 'bg-slate-50 text-slate-300 ring-slate-200',
      )}
    >
      {icon}
    </span>
  )
}
