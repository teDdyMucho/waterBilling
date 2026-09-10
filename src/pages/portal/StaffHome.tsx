import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Droplets, Receipt, Zap } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { WelcomeBanner } from '@/components/WelcomeBanner'
import { EncodeReadingModal } from '@/features/readings/EncodeReadingModal'
import { PropertyPicker, unassignedKindOf } from '@/features/readings/PropertyPicker'
import { fetchOpenWorklist } from '@/features/readings/readings-api'
import { fetchProperties } from '@/features/properties/properties-api'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import type { UtilityType } from '@/types/domain'

export default function StaffHome() {
  const { t } = useT()
  const { profile } = useAuth()
  // Alin sa dalawang malaking button ang pinindot — ito rin ang sinasala
  // sa modal, kaya isang metro lang ang haharapin ng reader.
  const [utility, setUtility] = useState<UtilityType | null>(null)
  const [propertyId, setPropertyId] = useState<string | null>(null)

  // Isa ang cycle kada property — lahat ng bukas ay nasa isang listahan,
  // at dala ng bawat item kung saang cycle ito mase-save.
  const { data: items } = useQuery({ queryKey: ['open-worklist'], queryFn: fetchOpenWorklist })
  // Lahat ng property — para makita rin ang wala pang bukas na cycle,
  // at para mahanap sila sa search.
  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })

  const list = items ?? []
  const hasOpen = list.length > 0
  // Ang picker ay ipinapakita lang ang mga property na may metrong ganitong
  // utility — walang mapipiling bahay na walang metrong babasahin.
  const forUtility = useMemo(
    () => (utility ? list.filter((i) => i.meter.utility_type === utility) : []),
    [list, utility],
  )
  // Unknown / C.O. Subdivision — walang tunay na metro; sa admin ito dadaan.
  const specialKind = unassignedKindOf(propertyId)
  const selectedItems = useMemo(
    () =>
      propertyId && !unassignedKindOf(propertyId)
        ? forUtility.filter((i) => i.property.id === propertyId)
        : [],
    [forUtility, propertyId],
  )

  function closeEncoder() {
    setUtility(null)
    setPropertyId(null)
  }

  return (
    <AppShell>
      <WelcomeBanner
        name={profile?.full_name?.split(' ')[0] ?? ''}
        subtitle={t('portal.staffHome')}
      />

      {/* Pangunahing aksyon — dalawang malaking button, isa kada utility */}
      <div className="mb-3 rounded-card border border-slate-200 bg-slate-50/60 p-5">
        <p className="font-semibold text-slate-900">{t('readings.quickEncode')}</p>
        <p className="mb-4 text-sm text-slate-600">{t('readings.quickEncodeSub')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            
            onClick={() => setUtility('water')}
            className="flex items-center gap-4 rounded-card border border-water-100 bg-water-50 p-5 text-left transition-colors hover:border-water-700/30 disabled:opacity-50"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-water-700 ring-1 ring-inset ring-water-100">
              <Droplets className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-slate-900">
                {t('properties.water')}
              </span>
              <span className="block text-sm text-slate-600">{t('readings.takePhoto')}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-slate-400" />
          </button>

          <button
            type="button"
            
            onClick={() => setUtility('electric')}
            className="flex items-center gap-4 rounded-card border border-power-100 bg-power-50 p-5 text-left transition-colors hover:border-power-700/30 disabled:opacity-50"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-power-700 ring-1 ring-inset ring-power-100">
              <Zap className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-slate-900">
                {t('properties.electric')}
              </span>
              <span className="block text-sm text-slate-600">{t('readings.takePhoto')}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-slate-400" />
          </button>
        </div>

        {!hasOpen && (
          <Alert tone="info" className="mt-4">
            {t('readings.noCycleButUnknown')}
          </Alert>
        )}
      </div>

      {/* Pangalawang aksyon */}
      <div className="mb-6 flex flex-col gap-3 rounded-card border border-slate-200 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
            <Receipt className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{t('billing.staffBillsTitle')}</p>
            <p className="text-sm text-slate-600">{t('billing.staffBillsSub')}</p>
          </div>
        </div>
        <Link to="/staff/bills" className="shrink-0">
          <Button variant="outline" iconRight={<ArrowRight className="size-4" />}>
            {t('common.view')}
          </Button>
        </Link>
      </div>

      <Alert tone="info" className="mb-6">
        Nakikita ng staff ang billing info at concern ng homeowner —
        <strong> hindi ang kanilang account.</strong>
      </Alert>

      {utility && (
        <EncodeReadingModal
          open
          onClose={closeEncoder}
          items={selectedItems}
          // Ang cycle ng napiling property. NULL kapag Unknown / C.O. —
          // walang property, kaya walang cycle; ang admin ang magtatakda.
          cycle={selectedItems[0]?.cycle ?? null}
          picker={
            <PropertyPicker
              items={forUtility}
              properties={properties ?? []}
              value={propertyId}
              onChange={setPropertyId}
            />
          }
          special={specialKind ? { kind: specialKind, utility } : undefined}
          heading={t(utility === 'water' ? 'properties.water' : 'properties.electric')}
        />
      )}
    </AppShell>
  )
}
