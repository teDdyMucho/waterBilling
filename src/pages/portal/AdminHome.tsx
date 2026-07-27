import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Clock,
  Home,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { StatTile } from '@/components/ui/StatTile'
import { Button } from '@/components/ui/Button'
import { PendingApprovals } from '@/features/admin/PendingApprovals'
import { fetchAllProfiles } from '@/features/admin/admin-api'
import { fetchDashboardStats } from '@/features/reports/reports-api'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { money } from '@/lib/format'

export default function AdminHome() {
  const { t } = useT()
  const { profile } = useAuth()

  const { data } = useQuery({ queryKey: ['all-profiles'], queryFn: fetchAllProfiles })
  const { data: stats } = useQuery({ queryKey: ['dash-stats'], queryFn: fetchDashboardStats })
  const all = data ?? []
  const count = {
    total: all.length,
    homeowners: all.filter((p) => p.role === 'homeowner').length,
    staff: all.filter((p) => p.role === 'staff').length,
    pending: all.filter((p) => p.status === 'pending').length,
  }

  return (
    <AppShell>
      <PageHeader
        title={`${t('portal.welcome')}, ${profile?.full_name?.split(' ')[0] ?? ''}`.trim()}
        description={t('portal.adminHome')}
        action={
          <Link to="/admin/reports">
            <Button variant="outline" iconRight={<ArrowRight className="size-4" />}>
              {t('reports.title')}
            </Button>
          </Link>
        }
      />

      {/* Financial KPIs */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Banknote className="size-5" />} label={t('reports.billed')} value={money(stats?.billed ?? 0)} tint="brand" />
        <StatTile icon={<PiggyBank className="size-5" />} label={t('reports.collected')} value={money(stats?.collected ?? 0)} tint="success" />
        <StatTile icon={<Wallet className="size-5" />} label={t('reports.outstanding')} value={money(stats?.outstanding ?? 0)} tint="warning" />
        <StatTile icon={<TrendingUp className="size-5" />} label={t('reports.rate')} value={`${((stats?.collectionRate ?? 0) * 100).toFixed(1)}%`} tint="info" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Users className="size-5" />}
          label={t('accounts.allUsers')}
          value={count.total}
          tint="brand"
        />
        <StatTile
          icon={<Home className="size-5" />}
          label="Homeowners"
          value={count.homeowners}
          tint="info"
        />
        <StatTile
          icon={<ShieldCheck className="size-5" />}
          label="Staff"
          value={count.staff}
          tint="success"
        />
        <StatTile
          icon={<Clock className="size-5" />}
          label={t('portal.pendingApprovals')}
          value={count.pending}
          tint="warning"
        />
      </div>

      <div className="mt-6">
        <PendingApprovals />
      </div>
    </AppShell>
  )
}
