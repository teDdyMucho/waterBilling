import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Headset,
  Lock,
  Paperclip,
  Send,
  UserCheck,
  X,
} from 'lucide-react'
import {
  fetchMessages,
  fetchThread,
  getAttachmentUrl,
  sendMessageWithFiles,
  setThreadStatus,
  assignThread,
} from '@/features/messaging/messaging-api'
import { supabase } from '@/lib/supabase'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Attachment, ThreadMessage, ThreadStatus } from '@/types/domain'

const STATUS_TONE: Record<ThreadStatus, BadgeTone> = {
  open: 'warning',
  in_progress: 'info',
  escalated: 'danger',
  resolved: 'success',
  closed: 'neutral',
}

export function MessageThreadView({ threadId, backTo }: { threadId: string; backTo: string }) {
  const { t } = useT()
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'
  const endRef = useRef<HTMLDivElement>(null)

  const { data: thread } = useQuery({ queryKey: ['thread', threadId], queryFn: () => fetchThread(threadId) })
  const { data: messages } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: () => fetchMessages(threadId),
  })

  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [note, setNote] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Realtime: bagong mensahe sa thread na ito
  useEffect(() => {
    const ch = supabase
      .channel(`thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ['messages', threadId] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [threadId, qc])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['messages', threadId] })
    qc.invalidateQueries({ queryKey: ['thread', threadId] })
    qc.invalidateQueries({ queryKey: ['threads'] })
  }

  const send = useMutation({
    mutationFn: () =>
      sendMessageWithFiles({
        threadId,
        senderId: user!.id,
        body,
        files,
        internalNote: note && isStaff,
      }),
    onSuccess: () => {
      setBody('')
      setFiles([])
      setNote(false)
      invalidate()
    },
  })

  const mStatus = useMutation({
    mutationFn: (s: ThreadStatus) => setThreadStatus(threadId, s),
    onSuccess: invalidate,
  })
  const mAssign = useMutation({
    mutationFn: () => assignThread(threadId, user!.id),
    onSuccess: invalidate,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim() && files.length === 0) return
    send.mutate()
  }

  if (!thread) return <PageLoader />

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        {t('messaging.back')}
      </Link>

      {/* Header — naka-fix (sticky) sa taas kapag nag-scroll */}
      <Card className="sticky top-16 z-20 mb-4 shadow-sm">
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{thread.subject}</h1>
                <Badge tone={STATUS_TONE[thread.status]}>{t(`messaging.st_${thread.status}`)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {thread.ticket_no} · {t(`messaging.cat_${thread.category}`)}
                {isStaff && thread.opener && ` · ${thread.opener.full_name}`}
              </p>
            </div>

            {isStaff && (
              <div className="flex flex-wrap gap-2">
                {!thread.assigned_to && (
                  <Button size="sm" variant="outline" onClick={() => mAssign.mutate()} iconLeft={<UserCheck className="size-3.5" />}>
                    {t('messaging.assignMe')}
                  </Button>
                )}
                {thread.status !== 'escalated' && profile?.role === 'staff' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mStatus.mutate('escalated')}
                    iconLeft={<ArrowUpRight className="size-3.5" />}
                  >
                    {t('messaging.escalate')}
                  </Button>
                )}
                {thread.status !== 'resolved' ? (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => mStatus.mutate('resolved')}
                    iconLeft={<CheckCircle2 className="size-3.5" />}
                  >
                    {t('messaging.resolve')}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => mStatus.mutate('open')}>
                    {t('messaging.reopen')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Messages */}
      <div className="space-y-3 pt-1">
        {(messages ?? []).map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={m.sender_id === user?.id}
            openerId={thread.opened_by}
            openerName={thread.opener?.full_name ?? null}
            openerAvatar={thread.opener?.avatar_url ?? null}
            myName={profile?.full_name ?? null}
            myAvatar={profile?.avatar_url ?? null}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      {thread.status !== 'closed' && (
        <Card className="sticky bottom-4 mt-4">
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('messaging.replyPh')}
                rows={2}
                className={cn(
                  'w-full rounded-input border px-3 py-2 text-slate-900 shadow-xs focus:outline-none focus:ring-2',
                  note
                    ? 'border-warning-300 bg-warning-50/40 focus:border-warning-500 focus:ring-warning-100'
                    : 'border-slate-300 focus:border-brand-600 focus:ring-brand-100',
                )}
              />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {f.name}
                      <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="grid size-10 place-items-center rounded-input text-slate-500 hover:bg-slate-100"
                    aria-label={t('messaging.attach')}
                  >
                    <Paperclip className="size-4" />
                  </button>
                  {isStaff && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                      <input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} className="size-4 rounded border-slate-300 text-warning-600" />
                      <Lock className="size-3.5" /> {t('messaging.internalNote')}
                    </label>
                  )}
                </div>
                <Button type="submit" loading={send.isPending} iconRight={<Send className="size-4" />}>
                  {t('messaging.send')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function MessageBubble({
  message: m,
  mine,
  openerId,
  openerName,
  openerAvatar,
  myName,
  myAvatar,
}: {
  message: ThreadMessage
  mine: boolean
  openerId: string
  openerName: string | null
  openerAvatar: string | null
  myName: string | null
  myAvatar: string | null
}) {
  const { t } = useT()
  const fromHomeowner = m.sender_id === openerId

  // Avatar: IMAGE kung meron, else initials. Headset kung galing sa opisina.
  let avatarEl
  if (m.is_internal_note) {
    avatarEl = (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning-600 text-white">
        <Lock className="size-3.5" />
      </span>
    )
  } else if (mine) {
    avatarEl = <Avatar url={myAvatar} name={myName} size="sm" className="bg-brand-700" />
  } else if (fromHomeowner) {
    avatarEl = <Avatar url={openerAvatar} name={openerName} size="sm" className="bg-slate-400" />
  } else {
    avatarEl = (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
        <Headset className="size-4" />
      </span>
    )
  }

  return (
    <div className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
      {avatarEl}
      <div className={cn('min-w-0 max-w-[80%]', mine && 'items-end text-right')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-3.5 py-2 text-sm',
            m.is_internal_note
              ? 'bg-warning-50 text-warning-900 ring-1 ring-inset ring-warning-200'
              : mine
                ? 'bg-brand-700 text-white'
                : 'bg-white text-slate-800 ring-1 ring-inset ring-slate-200',
          )}
        >
          {m.is_internal_note && (
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-warning-700">
              <Lock className="size-3" /> {t('messaging.note')}
            </span>
          )}
          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
          {m.attachments?.length > 0 && (
            <div className={cn('mt-1.5 space-y-1.5', mine && 'flex flex-col items-end')}>
              {m.attachments.map((a, i) =>
                isImageAttachment(a.name || a.path) ? (
                  <ImageAttachment key={i} attachment={a} />
                ) : (
                  <AttachmentChip key={i} attachment={a} mine={mine && !m.is_internal_note} />
                ),
              )}
            </div>
          )}
        </div>
        <p className="mt-0.5 text-[0.6875rem] text-slate-400">{dateTime(m.created_at)}</p>
      </div>
    </div>
  )
}

function isImageAttachment(nameOrPath: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp|avif)$/i.test(nameOrPath)
}

/** Litratong attachment — agad na ipinapakita bilang inline thumbnail. */
function ImageAttachment({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    getAttachmentUrl(attachment.path)
      .then((u) => active && setUrl(u))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [attachment.path])

  if (failed) return <AttachmentChip attachment={attachment} mine={false} />
  if (!url) {
    return <div className="shimmer h-40 w-56 max-w-full rounded-lg" aria-hidden />
  }
  return (
    <button
      type="button"
      onClick={() => window.open(url, '_blank', 'noopener')}
      className="block overflow-hidden rounded-lg ring-1 ring-inset ring-black/5"
      title={attachment.name}
    >
      <img
        src={url}
        alt={attachment.name}
        className="max-h-64 w-auto max-w-full object-cover transition-transform hover:scale-[1.02]"
      />
    </button>
  )
}

function AttachmentChip({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  async function open() {
    setLoading(true)
    try {
      const url = await getAttachmentUrl(attachment.path)
      window.open(url, '_blank', 'noopener')
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium',
        mine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      )}
    >
      <Paperclip className="size-3" />
      {attachment.name || t('messaging.attachment')}
    </button>
  )
}
