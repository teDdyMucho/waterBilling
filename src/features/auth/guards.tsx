import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/ui/Spinner'
import ProfileMissingPage from '@/pages/auth/ProfileMissingPage'
import { ROLE_HOME, type Role } from '@/types/domain'

/**
 * Saan dapat mapunta ang isang naka-login batay sa status/role.
 * Ito ang iisang pinagmumulan ng katotohanan para sa redirects.
 */
function destinationFor(status: string, role: Role): string {
  if (status === 'pending') return '/pending'
  if (status === 'suspended' || status === 'rejected') return '/blocked'
  return ROLE_HOME[role] // active
}

/**
 * Protektadong app routes. Kailangan ng session + active na status.
 * Ang guard na ito ang nagbabantay sa UI — ngunit ang RLS sa database
 * ang totoong depensa.
 */
export function RequireAuth() {
  const { loading, session, profile, profileReady } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profileReady) return <PageLoader />
  if (!profile) return <ProfileMissingPage />

  if (profile.status !== 'active') {
    return <Navigate to={destinationFor(profile.status, profile.role)} replace />
  }
  return <Outlet />
}

/** Nililimitahan ang isang bahagi sa ilang role lang. */
export function RoleGuard({ allow }: { allow: Role[] }) {
  const { profile } = useAuth()
  if (!profile) return <PageLoader />
  if (!allow.includes(profile.role)) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }
  return <Outlet />
}

/**
 * Para sa /login, /register, /forgot — kapag naka-login na, itapon sa
 * tamang destinasyon imbes na ipakita ulit ang form.
 */
export function PublicOnly() {
  const { loading, session, profile, profileReady } = useAuth()
  if (loading) return <PageLoader />
  if (session && !profileReady) return <PageLoader />
  if (session && profile) {
    return <Navigate to={destinationFor(profile.status, profile.role)} replace />
  }
  if (session && !profile) return <ProfileMissingPage />
  return <Outlet />
}

/**
 * Para sa /pending at /blocked — kailangan ng session at tugmang status.
 */
export function StatusRoute({ expect }: { expect: 'pending' | 'blocked' }) {
  const { loading, session, profile, profileReady } = useAuth()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profileReady) return <PageLoader />
  if (!profile) return <ProfileMissingPage />

  const isBlocked = profile.status === 'suspended' || profile.status === 'rejected'
  const matches = expect === 'pending' ? profile.status === 'pending' : isBlocked

  if (!matches) {
    return <Navigate to={destinationFor(profile.status, profile.role)} replace />
  }
  return <Outlet />
}
