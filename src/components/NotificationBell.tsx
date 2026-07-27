import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import {
  fetchNotifications,
  markAllRead,
  markRead,
} from '@/features/messaging/messaging-api'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

export function NotificationBell() {
  const { t } = useT()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: Boolean(user),
  })
  const notifications = data ?? []
  const unread = notifications.filter((n) => !n.is_read).length

  // Realtime: bagong notification para sa akin
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['notifications'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [user, qc])

  const mAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const mOne = useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notif.title')}
        className="relative grid size-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="size-[1.15rem]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[0.625rem] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-in absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-slate-200 bg-white shadow-overlay">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{t('notif.title')}</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => mAll.mutate()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  <CheckCheck className="size-3.5" />
                  {t('notif.markAll')}
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{t('notif.empty')}</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.is_read) mOne.mutate(n.id)
                        setOpen(false)
                        if (n.link) navigate(n.link)
                      }}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                        !n.is_read && 'bg-brand-50/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          n.is_read ? 'bg-transparent' : 'bg-brand-500',
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        {n.body && <p className="truncate text-xs text-slate-500">{n.body}</p>}
                        <p className="mt-0.5 text-[0.6875rem] text-slate-400">{dateTime(n.created_at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
