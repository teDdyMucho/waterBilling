import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, MessageSquare, Plus } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { MessageThreadView } from '@/features/messaging/MessageThreadView'
import { NewConcernModal } from '@/features/messaging/NewConcernModal'
import { fetchMyThreads } from '@/features/messaging/messaging-api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { dateTime } from '@/lib/format'
import type { ThreadStatus } from '@/types/domain'

const TONE: Record<ThreadStatus, BadgeTone> = {
  open: 'warning',
  in_progress: 'info',
  escalated: 'danger',
  resolved: 'success',
  closed: 'neutral',
}

export default function HomeownerMessages() {
  const { t } = useT()
  const { id } = useParams()
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['my-threads'], queryFn: fetchMyThreads })
  const threads = data ?? []

  if (id) {
    return (
      <AppShell>
        <MessageThreadView threadId={id} backTo="/dashboard/messages" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        title={t('messaging.myTitle')}
        description={t('messaging.mySub')}
        action={
          <Button onClick={() => setOpen(true)} iconLeft={<Plus className="size-4" />}>
            {t('messaging.new')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : threads.length === 0 ? (
        <Card>
          <div className="p-5">
            <EmptyState
              icon={<MessageSquare className="size-6" />}
              title={t('messaging.noThreads')}
              action={
                <Button onClick={() => setOpen(true)} iconLeft={<Plus className="size-4" />}>
                  {t('messaging.new')}
                </Button>
              }
            />
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {threads.map((th) => (
              <li key={th.id}>
                <Link
                  to={`/dashboard/messages/${th.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                    <MessageSquare className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{th.subject}</p>
                    <p className="text-xs text-slate-500">
                      {t(`messaging.cat_${th.category}`)} · {dateTime(th.last_message_at)}
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

      <NewConcernModal open={open} onClose={() => setOpen(false)} />
    </AppShell>
  )
}
