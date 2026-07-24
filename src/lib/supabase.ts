import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * BABALA: ANON KEY LANG ANG PUWEDE DITO.
 * Ang service-role key ay hindi kailanman ilalagay sa client bundle —
 * Edge Function lang ang puwedeng humawak nito. Ang seguridad ng sistema
 * ay nakasalalay sa Row Level Security sa database, hindi sa UI.
 */
export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'scs-billing-auth',
  },
})

/** Nakakonekta ba talaga tayo? Ginagamit sa landing at setup checks. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Isang hiwalay, HINDI-nagpe-persist na client — para makagawa ng bagong
 * user (staff/admin) ang admin nang HINDI nawawala ang sarili niyang session.
 *
 * Bakit ligtas kahit anon key lang: ang signUp ay gumagawa lang ng
 * homeowner/pending (tulad ng public register). Ang pag-angat nito sa
 * staff/admin ay UPDATE na protektado ng RLS — admin lang ang makakagawa.
 */
export function createProvisionClient() {
  return createClient(url ?? '', anonKey ?? '', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'scs-provision-temp',
    },
  })
}
