import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard, MessageSquare, Receipt } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { WelcomeBanner } from '@/components/WelcomeBanner'
import { FeaturePreviewGrid } from '@/components/FeaturePreviewGrid'
import { MyPropertyCard } from '@/features/properties/MyPropertyCard'
import { fetchMyBalance } from '@/features/billing/billing-api'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { lotLabel, money } from '@/lib/format'

export default function HomeownerHome() {
  const { t } = useT()
  const { profile } = useAuth()
  const { data: balance } = useQuery({ queryKey: ['my-balance'], queryFn: fetchMyBalance })

  return (
    <AppShell>
      <WelcomeBanner
        name={profile?.full_name?.split(' ')[0] ?? ''}
        subtitle={t('portal.homeownerHome')}
        badge={lotLabel(profile?.block, profile?.lot)}
      />

      {/* Balance card */}
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-brand">
              <Receipt className="size-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('billing.balance')}
              </p>
              <p className="tabular text-3xl font-bold text-slate-900">{money(balance ?? 0)}</p>
            </div>
          </div>
          <Link to="/dashboard/bills" className="shrink-0">
            <Button variant="outline" iconRight={<ArrowRight className="size-4" />}>
              {t('billing.myBillsTitle')}
            </Button>
          </Link>
        </CardBody>
      </Card>

      {/* Lote at metro + konsumo */}
      <MyPropertyCard />

      {/* Mga darating na feature */}
      <FeaturePreviewGrid
        items={[
          {
            icon: CreditCard,
            title: t('sidebar.payments'),
            desc: 'Magbayad online at i-upload ang resibo.',
            tint: 'success',
          },
          {
            icon: MessageSquare,
            title: t('sidebar.messages'),
            desc: 'Ipadala ang concern diretso sa staff at admin.',
            tint: 'info',
          },
        ]}
      />
    </AppShell>
  )
}
