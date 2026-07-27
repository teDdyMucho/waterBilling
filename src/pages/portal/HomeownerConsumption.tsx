import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Droplets, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { fetchMyConsumption, type ConsumptionPoint } from '@/features/readings/readings-api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { consumption as fmtCons, percentDelta } from '@/lib/format'
import { cn } from '@/lib/cn'

// Monochrome — dalawang neutral na shade para may subtle na pagkakaiba.
const WATER = '#27272b' // near-black
const ELECTRIC = '#56565c' // mid-gray

export default function HomeownerConsumption() {
  const { t } = useT()
  const { data, isLoading } = useQuery({ queryKey: ['my-consumption'], queryFn: fetchMyConsumption })
  const points = data ?? []

  return (
    <AppShell>
      <PageHeader title={t('consumption.title')} description={t('consumption.sub')} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : points.length === 0 ? (
        <Card>
          <div className="p-5">
            <EmptyState icon={<Droplets className="size-6" />} title={t('consumption.none')} />
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* MoM stat tiles */}
          <div className="grid gap-4 sm:grid-cols-2">
            <MoMTile points={points} utility="water" color={WATER} />
            <MoMTile points={points} utility="electric" color={ELECTRIC} />
          </div>

          <ConsumptionChart
            title={t('consumption.waterTitle')}
            icon={<Droplets className="size-4 text-water-600" />}
            points={points}
            dataKey="water"
            color={WATER}
            utility="water"
          />
          <ConsumptionChart
            title={t('consumption.electricTitle')}
            icon={<Zap className="size-4 text-power-600" />}
            points={points}
            dataKey="electric"
            color={ELECTRIC}
            utility="electric"
          />
        </div>
      )}
    </AppShell>
  )
}

function MoMTile({
  points,
  utility,
  color,
}: {
  points: ConsumptionPoint[]
  utility: 'water' | 'electric'
  color: string
}) {
  const { t } = useT()
  const series = points.map((p) => p[utility]).filter((v): v is number => v != null)
  const latest = series.at(-1) ?? 0
  const prev = series.at(-2)
  const ratio = prev && prev !== 0 ? (latest - prev) / prev : null
  const up = ratio != null && ratio > 0

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset"
          style={{ backgroundColor: `${color}14`, color, borderColor: `${color}33` }}
        >
          {utility === 'water' ? <Droplets className="size-5" /> : <Zap className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {utility === 'water' ? t('properties.water') : t('properties.electric')}
          </p>
          <p className="tabular text-2xl font-bold text-slate-900">{fmtCons(latest, utility)}</p>
        </div>
        {ratio != null && (
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
              up ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-700',
            )}
          >
            {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {percentDelta(ratio)}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">{t('consumption.vsLast')}</p>
    </Card>
  )
}

function ConsumptionChart({
  title,
  icon,
  points,
  dataKey,
  color,
  utility,
}: {
  title: string
  icon: React.ReactNode
  points: ConsumptionPoint[]
  dataKey: 'water' | 'electric'
  color: string
  utility: 'water' | 'electric'
}) {
  const { t } = useT()
  const rows = points.map((p) => ({ code: p.code, value: p[dataKey] ?? 0 }))
  const latestIdx = rows.length - 1

  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2">{icon}{title}</span>} />
      <CardBody>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="code"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: '#0f172a08' }}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  boxShadow: '0 10px 30px -10px rgb(15 23 42 / 0.25)',
                }}
                formatter={(v) => [fmtCons(Number(v ?? 0), utility), t('consumption.used')]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={color} fillOpacity={i === latestIdx ? 1 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}
