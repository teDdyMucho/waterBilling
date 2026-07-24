import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  KeyRound,
  MapPin,
  MoreVertical,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  approveProfile,
  fetchAllProfiles,
  rejectProfile,
  sendResetLink,
  setProfileRole,
  setProfileStatus,
  setProfileZone,
} from '@/features/admin/admin-api'
import { AddAccountModal } from '@/features/admin/AddAccountModal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AccountStatus, Profile, Role } from '@/types/domain'

const ROLE_TONE: Record<Role, BadgeTone> = {
  admin: 'brand',
  staff: 'info',
  homeowner: 'neutral',
}
const STATUS_TONE: Record<AccountStatus, BadgeTone> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  rejected: 'neutral',
}

type RoleFilter = 'all' | Role

export function AccountManagement() {
  const { t } = useT()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<RoleFilter>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: fetchAllProfiles,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['all-profiles'] })
    qc.invalidateQueries({ queryKey: ['pending-profiles'] })
  }
  const onErr = () => setError(t('common.somethingWrong'))

  const mStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      setProfileStatus(id, status),
    onSuccess: invalidate,
    onError: onErr,
  })
  const mRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => setProfileRole(id, role),
    onSuccess: invalidate,
    onError: onErr,
  })
  const mApprove = useMutation({
    mutationFn: approveProfile,
    onSuccess: invalidate,
    onError: onErr,
  })
  const mReject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectProfile(id, reason),
    onSuccess: invalidate,
    onError: onErr,
  })
  const mZone = useMutation({
    mutationFn: ({ id, zone }: { id: string; zone: string | null }) => setProfileZone(id, zone),
    onSuccess: invalidate,
    onError: onErr,
  })
  const mReset = useMutation({
    mutationFn: (email: string) => sendResetLink(email),
    onSuccess: () => window.alert(t('accounts.resetSent')),
    onError: onErr,
  })

  const busy =
    mStatus.isPending ||
    mRole.isPending ||
    mApprove.isPending ||
    mReject.isPending ||
    mZone.isPending ||
    mReset.isPending

  const users = useMemo(() => {
    const list = data ?? []
    const q = search.trim().toLowerCase()
    return list.filter((p) => {
      if (filter !== 'all' && p.role !== filter) return false
      if (!q) return true
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, search, filter])

  const filters: RoleFilter[] = ['all', 'admin', 'staff', 'homeowner']

  return (
    <>
      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 sm:max-w-xs">
          <Input
            placeholder={t('accounts.search')}
            iconLeft={<Search className="size-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setAddOpen(true)} iconLeft={<UserPlus className="size-4" />}>
          {t('accounts.addAccount')}
        </Button>
      </div>

      {/* Role filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              filter === f
                ? 'bg-brand-700 text-white'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
            )}
          >
            {f === 'all' ? t('accounts.filterAll') : f}
          </button>
        ))}
      </div>

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : users.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Users className="size-6" />} title={t('accounts.noUsers')} />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">{t('accounts.colUser')}</th>
                    <th className="px-5 py-3">{t('accounts.colRole')}</th>
                    <th className="px-5 py-3">{t('accounts.colStatus')}</th>
                    <th className="px-5 py-3">{t('accounts.colLot')}</th>
                    <th className="px-5 py-3 text-right">{t('accounts.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">
                          {p.full_name || '—'}
                          {p.id === user?.id && (
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              ({t('accounts.you')})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{p.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={ROLE_TONE[p.role]} className="capitalize">
                          {p.role}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={STATUS_TONE[p.status]}>
                          {t(`accounts.status${cap(p.status)}`)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {p.role === 'homeowner'
                          ? lotLabel(p.block, p.lot)
                          : p.role === 'staff'
                            ? (p.zone ?? '—')
                            : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActions
                          profile={p}
                          isSelf={p.id === user?.id}
                          busy={busy}
                          onApprove={() => mApprove.mutate(p.id)}
                          onReject={(r) => mReject.mutate({ id: p.id, reason: r })}
                          onStatus={(s) => mStatus.mutate({ id: p.id, status: s })}
                          onRole={(r) => mRole.mutate({ id: p.id, role: r })}
                          onSetZone={(z) => mZone.mutate({ id: p.id, zone: z })}
                          onSendReset={() => p.email && mReset.mutate(p.email)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {users.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {p.full_name || '—'}
                      {p.id === user?.id && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          ({t('accounts.you')})
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">{p.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={ROLE_TONE[p.role]} className="capitalize">
                        {p.role}
                      </Badge>
                      <Badge tone={STATUS_TONE[p.status]}>
                        {t(`accounts.status${cap(p.status)}`)}
                      </Badge>
                      {p.role === 'homeowner' && (
                        <span className="text-xs text-slate-400">
                          {lotLabel(p.block, p.lot)}
                        </span>
                      )}
                    </div>
                  </div>
                  <RowActions
                    profile={p}
                    isSelf={p.id === user?.id}
                    busy={busy}
                    onApprove={() => mApprove.mutate(p.id)}
                    onReject={(r) => mReject.mutate({ id: p.id, reason: r })}
                    onStatus={(s) => mStatus.mutate({ id: p.id, status: s })}
                    onRole={(r) => mRole.mutate({ id: p.id, role: r })}
                    onSetZone={(z) => mZone.mutate({ id: p.id, zone: z })}
                    onSendReset={() => p.email && mReset.mutate(p.email)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <AddAccountModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Per-row na aksyon menu (dropdown). */
function RowActions({
  profile,
  isSelf,
  busy,
  onApprove,
  onReject,
  onStatus,
  onRole,
  onSetZone,
  onSendReset,
}: {
  profile: Profile
  isSelf: boolean
  busy: boolean
  onApprove: () => void
  onReject: (reason: string) => void
  onStatus: (status: AccountStatus) => void
  onRole: (role: Role) => void
  onSetZone: (zone: string | null) => void
  onSendReset: () => void
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)

  // Hindi puwedeng galawin ang sarili — iwas i-lock ang sarili sa admin.
  if (isSelf) {
    return <span className="text-xs text-slate-300">—</span>
  }

  const actions: { label: string; tone?: 'danger'; run: () => void }[] = []

  if (profile.status === 'pending') {
    actions.push({ label: t('accounts.actionApprove'), run: onApprove })
    actions.push({
      label: t('accounts.actionReject'),
      tone: 'danger',
      run: () => {
        const r = window.prompt(t('portal.rejectReasonPrompt'))
        if (r && r.trim()) onReject(r.trim())
      },
    })
  }
  if (profile.status === 'active') {
    actions.push({
      label: t('accounts.actionSuspend'),
      tone: 'danger',
      run: () => onStatus('suspended'),
    })
  }
  if (profile.status === 'suspended' || profile.status === 'rejected') {
    actions.push({ label: t('accounts.actionReactivate'), run: () => onStatus('active') })
  }

  // Palitan ang role (maliban sa kasalukuyang role)
  const roleActions: { role: Role; label: string; confirm?: boolean }[] = [
    { role: 'homeowner', label: t('accounts.actionMakeHomeowner') },
    { role: 'staff', label: t('accounts.actionMakeStaff') },
    { role: 'admin', label: t('accounts.actionMakeAdmin'), confirm: true },
  ]

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('accounts.colActions')}
        className="grid size-9 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-in absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-card border border-slate-200 bg-white py-1 text-left shadow-overlay">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  setOpen(false)
                  a.run()
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50',
                  a.tone === 'danger' ? 'text-danger-600' : 'text-slate-700',
                )}
              >
                {a.tone === 'danger' ? (
                  <span className="size-1.5 rounded-full bg-danger-500" />
                ) : (
                  <Check className="size-4 text-slate-400" />
                )}
                {a.label}
              </button>
            ))}

            <div className="my-1 border-t border-slate-100" />

            {roleActions
              .filter((r) => r.role !== profile.role)
              .map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (r.confirm && !window.confirm(t('accounts.confirmMakeAdmin'))) return
                    onRole(r.role)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <ShieldCheck className="size-4 text-slate-400" />
                  {r.label}
                </button>
              ))}

            <div className="my-1 border-t border-slate-100" />

            {profile.role === 'staff' && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  const z = window.prompt(t('accounts.setZonePrompt'), profile.zone ?? '')
                  if (z !== null) onSetZone(z.trim() || null)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <MapPin className="size-4 text-slate-400" />
                {t('accounts.setZone')}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onSendReset()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <KeyRound className="size-4 text-slate-400" />
              {t('accounts.sendReset')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
