import { useQuery } from '@tanstack/react-query'
import { Building2, Droplets, Info, Zap } from 'lucide-react'
import { fetchMyProperty } from '@/features/properties/properties-api'
import { fetchLatestReading } from '@/features/readings/readings-api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { consumption as fmtConsumption, lotLabel, meterReading } from '@/lib/format'
import type { Meter, PropertyStatus, UtilityType } from '@/types/domain'

const STATUS_TONE: Record<PropertyStatus, BadgeTone> = {
  occupied: 'success',
  vacant: 'warning',
  inactive: 'neutral',
}

export function MyPropertyCard() {
  const { t } = useT()
  const { user } = useAuth()

  const { data: property, isLoading } = useQuery({
    queryKey: ['my-property', user?.id],
    queryFn: () => fetchMyProperty(user!.id),
    enabled: Boolean(user?.id),
  })

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardBody className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </CardBody>
      </Card>
    )
  }

  if (!property) {
    return (
      <Alert tone="info" title={t('properties.noOwner')} className="mb-6">
        Wala pang naka-link na lote sa account mo. Makipag-ugnayan sa opisina ng HOA.
      </Alert>
    )
  }

  const water = property.meters?.find((m) => m.utility_type === 'water' && m.status === 'active')
  const electric = property.meters?.find(
    (m) => m.utility_type === 'electric' && m.status === 'active',
  )

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Building2 className="size-4 text-brand-700" />
            {lotLabel(property.block, property.lot)}
          </span>
        }
        action={<Badge tone={STATUS_TONE[property.status]}>{t(`properties.${property.status}`)}</Badge>}
      />
      <CardBody className="grid gap-3 sm:grid-cols-2">
        <MeterCard utility="water" meter={water} />
        <MeterCard utility="electric" meter={electric} />
        <div className="sm:col-span-2">
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            Ang buwanang reading at konsumo ay lalabas dito kapag nasimulan na ang meter reading.
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

function MeterCard({ utility, meter }: { utility: UtilityType; meter?: Meter }) {
  const { t } = useT()
  const isWater = utility === 'water'
  const Icon = isWater ? Droplets : Zap
  const tone = isWater
    ? 'bg-water-50 text-water-700 ring-water-100'
    : 'bg-power-50 text-power-700 ring-power-100'

  const { data: latest } = useQuery({
    queryKey: ['latest-reading', meter?.id],
    queryFn: () => fetchLatestReading(meter!.id),
    enabled: Boolean(meter?.id),
  })

  return (
    <div className="flex items-center gap-3 rounded-input border border-slate-200 p-3.5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${tone}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {isWater ? t('properties.water') : t('properties.electric')}
          </p>
          {latest && (
            <span
              className={`tabular text-sm font-bold ${isWater ? 'text-water-700' : 'text-power-700'}`}
            >
              {fmtConsumption(latest.consumption, utility)}
            </span>
          )}
        </div>
        {meter ? (
          <p className="truncate text-xs text-slate-500">
            {latest ? (
              <>
                {t('readings.latestReading')}: {meterReading(latest.present_reading, meter.digits)}
                {' · '}#{meter.meter_number ?? '—'}
              </>
            ) : (
              <>
                #{meter.meter_number ?? '—'} · {t('readings.noReadingYet')}
              </>
            )}
          </p>
        ) : (
          <p className="text-xs italic text-slate-400">{t('properties.noMeter')}</p>
        )}
      </div>
    </div>
  )
}
