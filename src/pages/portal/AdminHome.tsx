import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Home, ShieldCheck, Users } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { StatTile } from '@/components/ui/StatTile'
import { Button } from '@/components/ui/Button'
import { PendingApprovals } from '@/features/admin/PendingApprovals'
import { fetchAllProfiles } from '@/features/admin/admin-api'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'

export default function AdminHome() {
  const { t } = useT()
  const { profile } = useAuth()

  const { data } = useQuery({ queryKey: ['all-profiles'], queryFn: fetchAllProfiles })
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
          <Link to="/admin/accounts">
            <Button variant="outline" iconRight={<ArrowRight className="size-4" />}>
              {t('accounts.title')}
            </Button>
          </Link>
        }
      />

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
