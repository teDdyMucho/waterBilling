import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import type { Language, Profile } from '@/types/domain'

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  contactNumber: string
  block: string
  lot: string
  language: Language
}

/**
 * Nagre-register ng bagong homeowner.
 * Naka-OFF ang email confirmation kaya agad na may session.
 * Ang metadata ay kinukuha ng handle_new_user() trigger para sa profiles row.
 */
export async function registerHomeowner(input: RegisterInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        contact_number: input.contactNumber.trim(),
        block: input.block.trim(),
        lot: input.lot.trim(),
        preferred_language: input.language,
      },
    },
  })
  if (error) throw error
  return data
}

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
