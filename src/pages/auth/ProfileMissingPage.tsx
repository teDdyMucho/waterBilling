import { DatabaseZap, LogOut } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'

/**
 * Ipinapakita kapag may session pero walang profile row.
 * Karaniwang dahilan: hindi pa na-run ang SQL migration (0001), o may
 * problema sa RLS. Iniiwas nito ang walang-katapusang spinner.
 */
export default function ProfileMissingPage() {
  const { signOut, user } = useAuth()

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <LogoMark className="mx-auto size-12" />
        <div className="mt-6 rounded-card border border-slate-200 bg-white p-6 text-left shadow-raised">
          <span className="grid size-12 place-items-center rounded-full bg-warning-50 text-warning-600 ring-1 ring-inset ring-warning-100">
            <DatabaseZap className="size-6" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-slate-900">
            Hindi mahanap ang profile
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            May account ka na (<span className="font-medium">{user?.email}</span>) pero walang
            katugmang profile sa database.
          </p>

          <Alert tone="info" className="mt-4">
            Kadalasan, hindi pa na-run ang SQL migration. I-paste at i-run ang{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              supabase/migrations/0001_auth_profiles.sql
            </code>{' '}
            sa Supabase SQL Editor, tapos mag-login ulit.
          </Alert>

          <Button
            variant="outline"
            block
            className="mt-5"
            iconLeft={<LogOut className="size-4" />}
            onClick={() => signOut()}
          >
            Mag-log out
          </Button>
        </div>
      </div>
    </div>
  )
}
