import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, MessageSquare, Search } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { MessageThreadView } from '@/features/messaging/MessageThreadView'
import { fetchAllThreads } from '@/features/messaging/messaging-api'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
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
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['threads'], queryFn: fetchAllThreads })
  const threads = data ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return threads.filter((th) => {
      const statusOk =
        filter === 'open'
          ? th.status === 'open' || th.status === 'in_progress'
          : filter === 'escalated'
            ? th.status === 'escalated'
            : filter === 'resolved'
              ? th.status === 'resolved' || th.status === 'closed'
              : true
      if (!statusOk) return false
      if (!q) return true
      return `${th.subject} ${th.opener?.full_name ?? ''} ${t(`messaging.cat_${th.category}`)}`
        .toLowerCase()
        .includes(q)
    })
  }, [threads, filter, search, t])

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

      <div className="mb-3 sm:max-w-xs">
        <Input
          placeholder={t('messaging.search')}
          iconLeft={<Search className="size-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
                  <Avatar
                    url={th.opener?.avatar_url}
                    name={th.opener?.full_name}
                    size="md"
                    className="size-10 bg-slate-400"
                  />
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
