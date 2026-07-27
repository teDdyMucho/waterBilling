import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, MessageSquare } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { MessageThreadView } from '@/features/messaging/MessageThreadView'
import { fetchAllThreads } from '@/features/messaging/messaging-api'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ThreadStatus } from '@/types/domain'

const TONE: Record<ThreadStatus, BadgeTone> = {
  open: 'warning',
  in_progress: 'info',
  escalated: 'danger',
  resolved: 'success',
  closed: 'neutral',
}

type Filter = 'all' | 'open' | 'escalated' | 'resolved'

/** Ginagamit ng staff (base='/staff/concerns') at admin (base='/admin/concerns'). */
export function ConcernsInbox({ base }: { base: string }) {
  const { t } = useT()
  const { id } = useParams()
  const [filter, setFilter] = useState<Filter>('all')

  const { data, isLoading } = useQuery({ queryKey: ['threads'], queryFn: fetchAllThreads })
  const threads = data ?? []

  const filtered = useMemo(() => {
    return threads.filter((th) => {
      if (filter === 'open') return th.status === 'open' || th.status === 'in_progress'
      if (filter === 'escalated') return th.status === 'escalated'
      if (filter === 'resolved') return th.status === 'resolved' || th.status === 'closed'
      return true
    })
  }, [threads, filter])

  if (id) {
    return (
      <AppShell>
        <MessageThreadView threadId={id} backTo={base} />
      </AppShell>
    )
  }

  const filters: Filter[] = ['all', 'open', 'escalated', 'resolved']

  return (
    <AppShell>
      <PageHeader title={t('messaging.inboxTitle')} description={t('messaging.inboxSub')} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-brand-700 text-white'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
            )}
          >
            {t(`messaging.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="p-5">
            <EmptyState icon={<MessageSquare className="size-6" />} title={t('messaging.noThreadsInbox')} />
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {filtered.map((th) => (
              <li key={th.id}>
                <Link
                  to={`${base}/${th.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                    <MessageSquare className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{th.subject}</p>
                    <p className="truncate text-xs text-slate-500">
                      {th.opener?.full_name ?? '—'} · {t(`messaging.cat_${th.category}`)} ·{' '}
                      {dateTime(th.last_message_at)}
                    </p>
                  </div>
                  <Badge tone={TONE[th.status]}>{t(`messaging.st_${th.status}`)}</Badge>
                  <ChevronRight className="size-5 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  )
}

export function StaffConcerns() {
  return <ConcernsInbox base="/staff/concerns" />
}
export function AdminConcerns() {
  return <ConcernsInbox base="/admin/concerns" />
}
