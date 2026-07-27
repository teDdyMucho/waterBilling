import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarClock, CreditCard, MessageSquare, Receipt } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { WelcomeBanner } from '@/components/WelcomeBanner'
import { FeaturePreviewGrid } from '@/components/FeaturePreviewGrid'
import { MyPropertyCard } from '@/features/properties/MyPropertyCard'
import { fetchAmountDue } from '@/features/billing/billing-api'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { daysUntil, longDate, lotLabel, money } from '@/lib/format'
import { cn } from '@/lib/cn'

export default function HomeownerHome() {
  const { t } = useT()
  const { profile } = useAuth()
  const { data: due } = useQuery({ queryKey: ['my-amount-due'], queryFn: fetchAmountDue })

  const total = due?.total ?? 0
  const dueDate = due?.dueDate ?? null
  const days = dueDate ? daysUntil(dueDate) : null
  const isOverdue = Boolean(due?.overdue) || (days != null && days < 0)
  const nothing = total <= 0

  // Sub-line na nagpapakita ng petsa/countdown
  let subLine = t('home.nothingDue')
  if (!nothing && dueDate) {
    if (isOverdue) subLine = t('home.overdue').replace('{date}', longDate(dueDate))
    else if (days === 0) subLine = t('home.dueToday')
    else if (days != null)
      subLine =
        t('home.dueOn').replace('{date}', longDate(dueDate)) +
        ' · ' +
        t('home.daysLeft').replace('{n}', String(days))
  }

  return (
    <AppShell>
      <WelcomeBanner
        name={profile?.full_name?.split(' ')[0] ?? ''}
        subtitle={t('portal.homeownerHome')}
        badge={lotLabel(profile?.block, profile?.lot)}
      />

      {/* Babayaran ngayong buwan */}
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'grid size-12 shrink-0 place-items-center rounded-xl text-white',
                isOverdue ? 'bg-danger-600 shadow-[0_8px_24px_-6px_rgb(220_38_38/0.4)]' : 'bg-brand-600 shadow-brand',
              )}
            >
              {isOverdue ? <AlertTriangle className="size-6" /> : <Receipt className="size-6" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('home.toPay')}
              </p>
              <p className="tabular text-3xl font-bold text-slate-900">{money(total)}</p>
              <p
                className={cn(
                  'mt-0.5 flex items-center gap-1.5 text-sm',
                  isOverdue ? 'font-medium text-danger-600' : 'text-slate-500',
                )}
              >
                {!nothing && <CalendarClock className="size-3.5 shrink-0" />}
                {subLine}
              </p>
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
