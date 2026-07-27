import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { fetchAuditLogs } from '@/features/reports/reports-api'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { dateTime } from '@/lib/format'

const ACTION_TONE: Record<string, BadgeTone> = {
  confirm_payment: 'success',
  endorse_payment: 'info',
  reject_payment: 'danger',
  void_payment: 'warning',
}

export default function AdminAudit() {
  const { t } = useT()
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs'], queryFn: fetchAuditLogs })
  const rows = data ?? []

  return (
    <AppShell>
      <PageHeader title={t('reports.auditTitle')} description={t('reports.auditSub')} />

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<ScrollText className="size-6" />} title={t('reports.auditEmpty')} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-4 sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    <ScrollText className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ACTION_TONE[r.action] ?? 'neutral'}>{r.action}</Badge>
                      <span className="text-sm text-slate-500">{r.entity_table}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      {t('reports.actor')}: <strong>{r.actor?.full_name ?? '—'}</strong>
                    </p>
                    {r.new_values != null && (
                      <p className="truncate text-xs text-slate-400">
                        {JSON.stringify(r.new_values)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{dateTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  )
}
