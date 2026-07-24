import { createProvisionClient, supabase } from '@/lib/supabase'
import type { AccountStatus, Profile, Role } from '@/types/domain'

/** Lahat ng naghihintay ng approval (pinakaluma muna). */
export async function fetchPendingProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

/** Lahat ng profile (para sa Account Management). */
export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}

/** Baguhin ang status (activate / suspend / etc.). Admin lang (RLS). */
export async function setProfileStatus(id: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.from('profiles').update({ status }).eq('id', id)
  if (error) throw error
}

/** Baguhin ang role. Admin lang (RLS). */
export async function setProfileRole(id: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

/** Itakda ang zone ng isang staff. Admin lang (RLS). */
export async function setProfileZone(id: string, zone: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ zone }).eq('id', id)
  if (error) throw error
}

/** Magpadala ng password-reset link sa email ng user (admin-initiated). */
export async function sendResetLink(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export interface ProvisionInput {
  email: string
  password: string
  fullName: string
  contactNumber?: string
  role: 'staff' | 'admin'
  zone?: string
}

/**
 * Gumawa ng bagong STAFF o ADMIN account mula sa admin dashboard.
 *
 * Hakbang:
 *  1) Gumamit ng hiwalay na client para mag-signUp (homeowner/pending muna)
 *     — hindi maaapektuhan ang session ng admin.
 *  2) Gamit ang session ng admin (RLS), itaas ang role at gawing active.
 *
 * Aktibo agad — WALANG pending confirmation ang staff/admin (homeowner lang).
 */
export async function provisionUser(input: ProvisionInput): Promise<void> {
  const temp = createProvisionClient()

  const { data, error } = await temp.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        contact_number: input.contactNumber?.trim() ?? '',
        preferred_language: 'tl',
      },
    },
  })
  if (error) throw error

  const newId = data.user?.id
  if (!newId) throw new Error('Walang bagong user id.')

  // Linisin ang pansamantalang session
  await temp.auth.signOut()

  // Itaas gamit ang admin RLS (protektado — admin lang ang makakagawa nito)
  const { error: upErr } = await supabase
    .from('profiles')
    .update({
      role: input.role,
      status: 'active',
      full_name: input.fullName.trim(),
      contact_number: input.contactNumber?.trim() ?? null,
      zone: input.role === 'staff' ? input.zone?.trim() || null : null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', newId)
  if (upErr) throw upErr
}

/** Aprubahan ang isang rehistro → status = active. */
export async function approveProfile(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('profiles')
    .update({
      status: 'active',
      approved_by: auth.user?.id ?? null,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', id)
  if (error) throw error
}

/** Tanggihan ang rehistro → status = rejected + dahilan. */
export async function rejectProfile(id: string, reason: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('profiles')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      approved_by: auth.user?.id ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}
