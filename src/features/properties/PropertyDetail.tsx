import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Droplets,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import {
  deleteProperty,
  fetchHomeownerDirectory,
  fetchProperty,
  linkOwner,
  unlinkOwner,
} from '@/features/properties/properties-api'
import { PropertyFormModal } from '@/features/properties/PropertyFormModal'
import { MeterFormModal } from '@/features/properties/MeterFormModal'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { PageLoader } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { lotLabel, meterReading, shortDate } from '@/lib/format'
import type { Meter, PropertyStatus, UtilityType } from '@/types/domain'

const STATUS_TONE: Record<PropertyStatus, BadgeTone> = {
  occupied: 'success',
  vacant: 'warning',
  inactive: 'neutral',
}

export function PropertyDetail({ basePath }: { basePath: string }) {
  const { t } = useT()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const readOnly = !basePath.startsWith('/admin')

  const [editOpen, setEditOpen] = useState(false)
  const [meterModal, setMeterModal] = useState<{
    utility: UtilityType
    editing?: Meter
    replacing?: Meter
  } | null>(null)
  const [linkTo, setLinkTo] = useState('')

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => fetchProperty(id),
  })
  const { data: directory } = useQuery({
    queryKey: ['homeowner-directory'],
    queryFn: fetchHomeownerDirectory,
    enabled: !readOnly,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['property', id] })
    qc.invalidateQueries({ queryKey: ['properties'] })
  }

  const mDelete = useMutation({
    mutationFn: () => deleteProperty(id),
    onSuccess: () => navigate(basePath, { replace: true }),
  })
  const mLink = useMutation({
    mutationFn: (profileId: string) => linkOwner(id, profileId),
    onSuccess: () => {
      setLinkTo('')
      invalidate()
    },
  })
  const mUnlink = useMutation({
    mutationFn: (linkId: string) => unlinkOwner(linkId),
    onSuccess: invalidate,
  })

  if (isLoading) return <PageLoader />
  if (!property) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-slate-500">Hindi mahanap ang lote.</p>
          <Link to={basePath} className="mt-2 inline-block text-sm font-medium text-brand-700">
            {t('properties.back')}
          </Link>
        </CardBody>
      </Card>
    )
  }

  const activeOwners = property.owners?.filter((o) => !o.end_date) ?? []
  const linkedIds = new Set(activeOwners.map((o) => o.profile_id))
  const water = property.meters?.find((m) => m.utility_type === 'water' && m.status === 'active')
  const electric = property.meters?.find(
    (m) => m.utility_type === 'electric' && m.status === 'active',
  )

  return (
    <>
      <Link
        to={basePath}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        {t('properties.back')}
      </Link>

      {/* Header */}
      <Card className="mb-5">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {lotLabel(property.block, property.lot)}
              </h1>
              <Badge tone={STATUS_TONE[property.status]}>{t(`properties.${property.status}`)}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[property.phase, property.assigned_zone, property.address_line]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)} iconLeft={<Pencil className="size-4" />}>
                {t('common.edit')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm(t('properties.confirmDelete'))) mDelete.mutate()
                }}
                className="text-danger-600 hover:bg-danger-50"
                iconLeft={<Trash2 className="size-4" />}
              >
                {t('properties.deleteProperty')}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Meters */}
        <Card>
          <CardHeader title={t('properties.meters')} />
          <CardBody className="space-y-3">
            <MeterSlot
              utility="water"
              meter={water}
              readOnly={readOnly}
              onAdd={() => setMeterModal({ utility: 'water' })}
              onEdit={(m) => setMeterModal({ utility: 'water', editing: m })}
              onReplace={(m) => setMeterModal({ utility: 'water', replacing: m })}
            />
            <MeterSlot
              utility="electric"
              meter={electric}
              readOnly={readOnly}
              onAdd={() => setMeterModal({ utility: 'electric' })}
              onEdit={(m) => setMeterModal({ utility: 'electric', editing: m })}
              onReplace={(m) => setMeterModal({ utility: 'electric', replacing: m })}
            />
          </CardBody>
        </Card>

        {/* Owners */}
        <Card>
          <CardHeader title={t('properties.owners')} />
          <CardBody className="space-y-3">
            {activeOwners.length === 0 && (
              <p className="text-sm italic text-slate-400">{t('properties.noOwner')}</p>
            )}
            {activeOwners.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-input border border-slate-200 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <Users className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {o.profile?.full_name ?? '—'}
                    </p>
                    <p className="truncate text-xs text-slate-500">{o.profile?.email}</p>
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => mUnlink.mutate(o.id)}
                    aria-label={t('properties.unlink')}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}

            {!readOnly && (
              <div className="flex gap-2 pt-1">
                <Select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="flex-1">
                  <option value="">{t('properties.selectHomeowner')}</option>
                  {(directory ?? [])
                    .filter((h) => !linkedIds.has(h.id))
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.full_name} — {h.email}
                      </option>
                    ))}
                </Select>
                <Button
                  disabled={!linkTo || mLink.isPending}
                  onClick={() => linkTo && mLink.mutate(linkTo)}
                  iconLeft={mLink.isPending ? <Spinner className="size-4" /> : <UserPlus className="size-4" />}
                >
                  {t('properties.linkOwner')}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {!readOnly && (
        <>
          <PropertyFormModal open={editOpen} onClose={() => setEditOpen(false)} editing={property} />
          {meterModal && (
            <MeterFormModal
              open
              onClose={() => setMeterModal(null)}
              propertyId={property.id}
              utility={meterModal.utility}
              editing={meterModal.editing}
              replacing={meterModal.replacing}
            />
          )}
        </>
      )}
    </>
  )
}

function MeterSlot({
  utility,
  meter,
  readOnly,
  onAdd,
  onEdit,
  onReplace,
}: {
  utility: UtilityType
  meter?: Meter
  readOnly: boolean
  onAdd: () => void
  onEdit: (m: Meter) => void
  onReplace: (m: Meter) => void
}) {
  const { t } = useT()
  const isWater = utility === 'water'
  const Icon = isWater ? Droplets : Zap
  const tone = isWater
    ? 'bg-water-50 text-water-700 ring-water-100'
    : 'bg-power-50 text-power-700 ring-power-100'

  return (
    <div className="flex items-center gap-3 rounded-input border border-slate-200 p-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${tone}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          {isWater ? t('properties.water') : t('properties.electric')}
        </p>
        {meter ? (
          <p className="truncate text-xs text-slate-500">
            {meter.meter_number ?? '—'} · {t('properties.initialReading')}:{' '}
            {meterReading(meter.initial_reading, meter.digits)}
            {meter.installed_at && ` · ${shortDate(meter.installed_at)}`}
          </p>
        ) : (
          <p className="text-xs italic text-slate-400">{t('properties.noMeter')}</p>
        )}
      </div>
      {!readOnly &&
        (meter ? (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onReplace(meter)}>
              {t('properties.replace')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(meter)}
              iconLeft={<Pencil className="size-3.5" />}
            >
              {t('common.edit')}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={onAdd} iconLeft={<Plus className="size-3.5" />}>
            {t('properties.addMeter')}
          </Button>
        ))}
    </div>
  )
}
