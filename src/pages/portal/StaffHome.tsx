import { Link } from 'react-router-dom'
import { ArrowRight, Camera, MessageSquare, Receipt } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { WelcomeBanner } from '@/components/WelcomeBanner'
import { FeaturePreviewGrid } from '@/components/FeaturePreviewGrid'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'

export default function StaffHome() {
  const { t } = useT()
  const { profile } = useAuth()

  return (
    <AppShell>
      <WelcomeBanner
        name={profile?.full_name?.split(' ')[0] ?? ''}
        subtitle={t('portal.staffHome')}
      />

      {/* Live na aksyon */}
      <div className="mb-6 flex flex-col gap-3 rounded-card border border-brand-200 bg-brand-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-brand">
            <Camera className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{t('readings.worklistTitle')}</p>
            <p className="text-sm text-slate-600">{t('readings.worklistSub')}</p>
          </div>
        </div>
        <Link to="/staff/readings" className="shrink-0">
          <Button iconRight={<ArrowRight className="size-4" />}>{t('readings.encode')}</Button>
        </Link>
      </div>

      <Alert tone="info" className="mb-6">
        Nakikita ng staff ang billing info at concern ng homeowner —
        <strong> hindi ang kanilang account.</strong>
      </Alert>

      <FeaturePreviewGrid
        items={[
          {
            icon: Receipt,
            title: t('sidebar.bills'),
            desc: 'Tingnan ang bill at balanse ng homeowner.',
            tint: 'success',
          },
          {
            icon: MessageSquare,
            title: t('sidebar.concerns'),
            desc: 'Sagutin ang mga concern at requirement.',
            tint: 'power',
          },
        ]}
      />
    </AppShell>
  )
}
