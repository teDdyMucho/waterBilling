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
  // Wala nang self-registration at approval — ang admin ang gumagawa ng
  // account at aktibo agad ito. Ang natitirang 'pending' ay lumang rekord;
  // itinuturing na naka-block hanggang i-activate ng admin, para hindi ito
  // mapunta sa pahinang wala na.
  if (status === 'suspended' || status === 'rejected' || status === 'pending') {
    return '/blocked'
  }
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
  // Bagong homeowner na gawa ng staff — kailangan munang punan ang
  // pangalan at address bago makapasok sa dashboard.
  if (profile.role === 'homeowner' && !profile.setup_completed_at) {
    return <Navigate to="/setup" replace />
  }
  return <Outlet />
}

/**
 * Para sa /setup — kailangan ng aktibong homeowner na hindi pa tapos.
 * Kapag tapos na, itinatapon sa dashboard para hindi na ito mabalikan.
 */
export function RequireSetup() {
  const { loading, session, profile, profileReady } = useAuth()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profileReady) return <PageLoader />
  if (!profile) return <ProfileMissingPage />
  if (profile.status !== 'active') {
    return <Navigate to={destinationFor(profile.status, profile.role)} replace />
  }
  if (profile.role !== 'homeowner' || profile.setup_completed_at) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
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
 * Para sa /login at /forgot — kapag naka-login na, itapon sa tamang
 * destinasyon imbes na ipakita ulit ang form.
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

/** Para sa /blocked — kailangan ng session at hindi-aktibong status. */
export function StatusRoute() {
  const { loading, session, profile, profileReady } = useAuth()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profileReady) return <PageLoader />
  if (!profile) return <ProfileMissingPage />

  const isBlocked =
    profile.status === 'suspended' || profile.status === 'rejected' || profile.status === 'pending'

  if (!isBlocked) {
    return <Navigate to={destinationFor(profile.status, profile.role)} replace />
  }
  return <Outlet />
}
