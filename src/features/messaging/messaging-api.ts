import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import type {
  AppNotification,
  Attachment,
  MessageThread,
  ThreadCategory,
  ThreadMessage,
  ThreadStatus,
  ThreadWithOpener,
} from '@/types/domain'

// ---- Threads --------------------------------------------------------

/** Mga concern ng kasalukuyang homeowner. */
export async function fetchMyThreads(): Promise<MessageThread[]> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*')
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MessageThread[]
}

/** Lahat ng concern (staff/admin inbox), may pangalan ng nag-open. */
export async function fetchAllThreads(): Promise<ThreadWithOpener[]> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*, opener:profiles!message_threads_opened_by_fkey(full_name)')
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ThreadWithOpener[]
}

export async function fetchThread(id: string): Promise<ThreadWithOpener | null> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*, opener:profiles!message_threads_opened_by_fkey(full_name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as ThreadWithOpener) ?? null
}

export interface NewThreadInput {
  subject: string
  category: ThreadCategory
  body: string
  openedBy: string
  files?: File[]
}

/** Gumawa ng bagong concern + unang mensahe (+ optional attachments). */
export async function createThread(input: NewThreadInput): Promise<string> {
  const { data, error } = await supabase
    .from('message_threads')
    .insert({ subject: input.subject.trim(), category: input.category, opened_by: input.openedBy })
    .select('id')
    .single()
  if (error) throw error
  const threadId = (data as { id: string }).id

  const attachments = await uploadAttachments(threadId, input.files ?? [])
  await sendMessage({
    threadId,
    senderId: input.openedBy,
    body: input.body,
    attachments,
  })
  return threadId
}

// ---- Messages -------------------------------------------------------

export async function fetchMessages(threadId: string): Promise<ThreadMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ThreadMessage[]
}

export async function sendMessage(input: {
  threadId: string
  senderId: string
  body: string
  attachments?: Attachment[]
  internalNote?: boolean
}): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    thread_id: input.threadId,
    sender_id: input.senderId,
    body: input.body.trim(),
    attachments: input.attachments ?? [],
    is_internal_note: input.internalNote ?? false,
  })
  if (error) throw error
}

async function uploadAttachments(threadId: string, files: File[]): Promise<Attachment[]> {
  const out: Attachment[] = []
  for (const file of files) {
    const isImage = file.type.startsWith('image/')
    const blob = isImage ? await compressImage(file, { maxDim: 1600, quality: 0.75 }) : file
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${threadId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('message-attachments')
      .upload(path, blob, { contentType: file.type || 'application/octet-stream' })
    if (error) throw error
    out.push({ path, name: file.name })
  }
  return out
}

export async function sendMessageWithFiles(input: {
  threadId: string
  senderId: string
  body: string
  files?: File[]
  internalNote?: boolean
}): Promise<void> {
  const attachments = await uploadAttachments(input.threadId, input.files ?? [])
  await sendMessage({
    threadId: input.threadId,
    senderId: input.senderId,
    body: input.body,
    attachments,
    internalNote: input.internalNote,
  })
}

export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('message-attachments')
    .createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

// ---- Thread actions (staff/admin) -----------------------------------

export async function setThreadStatus(id: string, status: ThreadStatus): Promise<void> {
  const { error } = await supabase.from('message_threads').update({ status }).eq('id', id)
  if (error) throw error
}

export async function assignThread(id: string, staffId: string | null): Promise<void> {
  const { error } = await supabase
    .from('message_threads')
    .update({ assigned_to: staffId, status: 'in_progress' })
    .eq('id', id)
  if (error) throw error
}

// ---- Notifications --------------------------------------------------

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) throw error
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}
