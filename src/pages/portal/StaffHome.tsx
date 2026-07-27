import { Link } from 'react-router-dom'
import { ArrowRight, Camera, Receipt } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { WelcomeBanner } from '@/components/WelcomeBanner'
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
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card border border-slate-200 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
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

        <div className="flex flex-col gap-3 rounded-card border border-slate-200 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
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
      </div>

      <Alert tone="info" className="mb-6">
        Nakikita ng staff ang billing info at concern ng homeowner —
        <strong> hindi ang kanilang account.</strong>
      </Alert>
    </AppShell>
  )
}
