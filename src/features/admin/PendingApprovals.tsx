import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Mail, MapPin, Phone, UserCheck, X } from 'lucide-react'
import {
  approveProfile,
  fetchPendingProfiles,
  rejectProfile,
} from '@/features/admin/admin-api'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { lotLabel, shortDate } from '@/lib/format'
import type { Profile } from '@/types/domain'

export function PendingApprovals() {
  const { t } = useT()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pending-profiles'],
    queryFn: fetchPendingProfiles,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pending-profiles'] })

  const approve = useMutation({
    mutationFn: approveProfile,
    onSuccess: invalidate,
    onError: () => setError(t('common.somethingWrong')),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectProfile(id, reason),
    onSuccess: invalidate,
    onError: () => setError(t('common.somethingWrong')),
  })

  const pending = data ?? []

  return (
    <Card>
      <CardHeader
        title={t('portal.pendingApprovals')}
        action={
          pending.length > 0 ? (
            <Badge tone="warning">{pending.length}</Badge>
          ) : undefined
        }
      />

      {error && (
        <div className="px-4 pt-4 sm:px-5">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
          <Spinner className="size-4" /> {t('common.loading')}
        </div>
      ) : pending.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={<UserCheck className="size-6" />}
            title={t('portal.noPending')}
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {pending.map((p) => (
            <ApprovalRow
              key={p.id}
              profile={p}
              busy={approve.isPending || reject.isPending}
              onApprove={() => {
                setError(null)
                approve.mutate(p.id)
              }}
              onReject={(reason) => {
                setError(null)
                reject.mutate({ id: p.id, reason })
              }}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function ApprovalRow({
  profile,
  busy,
  onApprove,
  onReject,
}: {
  profile: Profile
  busy: boolean
  onApprove: () => void
  onReject: (reason: string) => void
}) {
  const { t } = useT()

  function handleReject() {
    const reason = window.prompt(t('portal.rejectReasonPrompt'))
    if (reason && reason.trim()) onReject(reason.trim())
  }

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{profile.full_name || '—'}</p>
          <Badge tone="neutral">{shortDate(profile.created_at)}</Badge>
        </div>
        <div className="mt-1.5 flex flex-col gap-x-5 gap-y-1 text-sm text-slate-500 sm:flex-row sm:flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5 shrink-0" /> {profile.email}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0" /> {profile.contact_number ?? '—'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" /> {lotLabel(profile.block, profile.lot)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={handleReject}
          iconLeft={<X className="size-4" />}
          className="flex-1 sm:flex-none"
        >
          {t('portal.reject')}
        </Button>
        <Button
          size="sm"
          variant="success"
          disabled={busy}
          onClick={onApprove}
          iconLeft={<Check className="size-4" />}
          className="flex-1 sm:flex-none"
        >
          {t('portal.approve')}
        </Button>
      </div>
    </li>
  )
}
