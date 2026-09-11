import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import type { Profile } from '@/types/domain'

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Ina-update ng user ang sariling profile (name/contact/language/avatar). */
export async function updateMyProfile(
  userId: string,
  input: {
    full_name?: string
    contact_number?: string
    preferred_language?: string
    avatar_url?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(input).eq('id', userId)
  if (error) throw error
}

/**
 * I-upload ang avatar (compressed) sa public na avatars bucket, tapos
 * i-save ang public URL sa profile. Ibinabalik ang URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await compressImage(file, { maxDim: 512, quality: 0.8 })
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  await updateMyProfile(userId, { avatar_url: data.publicUrl })
  return data.publicUrl
}

/** Kinukuha ang profile row ng kasalukuyang user (o null kung wala pa). */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

/** Ang ipinapakita sa /welcome/:token — limitado, pampubliko (0032). */
export type WelcomeInfo = {
  block: string | null
  lot: string | null
  email: string | null
  status: string
  setup_done: boolean
}

/** NULL kapag hindi valid ang token. Puwedeng tawagin kahit hindi naka-login. */
export async function fetchWelcomeInfo(token: string): Promise<WelcomeInfo | null> {
  const { data, error } = await supabase.rpc('welcome_info', { p_token: token })
  if (error) throw error
  return (data as WelcomeInfo | null) ?? null
}

/** Ang link na ibinibigay sa homeowner — isang link lang, walang password. */
export function welcomeLink(inviteToken: string) {
  return `${window.location.origin}/welcome/${inviteToken}`
}
