import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fetchProfile, signOut as apiSignOut } from './auth-api'
import type { Profile } from '@/types/domain'

interface AuthValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** Habang unang bina-boot ang auth state. */
  loading: boolean
  /**
   * True kung natapos na ang pagkuha ng profile para sa kasalukuyang user.
   * Kung session ay meron pero profile ay null habang ready=true → walang
   * profile row (hal. hindi pa na-run ang SQL migration).
   */
  profileReady: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Kaninong user id na ang natapos naming kunan ng profile (kahit null resulta).
  const [resolvedFor, setResolvedFor] = useState<string | null>(null)
  const mounted = useRef(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      setResolvedFor(null)
      return
    }
    try {
      let p = await fetchProfile(userId)
      // Bagong signup: baka bahagyang na-delay ang trigger row — subukan ulit.
      if (!p) {
        await new Promise((r) => setTimeout(r, 700))
        p = await fetchProfile(userId)
      }
      if (mounted.current) setProfile(p)
    } catch {
      if (mounted.current) setProfile(null)
    } finally {
      if (mounted.current) setResolvedFor(userId)
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      if (mounted.current) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted.current) return
      setSession(s)
      await loadProfile(s?.user?.id)
      if (mounted.current) setLoading(false)
    })

    return () => {
      mounted.current = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(
    () => loadProfile(session?.user?.id),
    [loadProfile, session?.user?.id],
  )

  const signOut = useCallback(async () => {
    await apiSignOut()
    setProfile(null)
    setSession(null)
    setResolvedFor(null)
  }, [])

  const profileReady = session ? resolvedFor === session.user.id : true

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileReady,
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, profileReady, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
