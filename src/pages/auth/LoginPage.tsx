import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { AuthShell } from '@/features/auth/AuthShell'
import { signInWithPassword } from '@/features/auth/auth-api'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'

export default function LoginPage() {
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithPassword(email, password)
      // Ang PublicOnly guard ang bahala sa tamang redirect (role/status)
      // kapag na-update na ang auth state.
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        /invalid login/i.test(msg) ? t('auth.invalidLogin') : t('common.somethingWrong'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSub')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">
            {t('auth.registerLink')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Input
          type="email"
          label={t('auth.email')}
          placeholder={t('auth.emailPh')}
          iconLeft={<Mail className="size-4" />}
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <PasswordInput
            label={t('auth.password')}
            placeholder={t('auth.passwordPh')}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-1.5 text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              {t('auth.forgot')}
            </Link>
          </div>
        </div>

        <Button type="submit" block size="lg" loading={loading}>
          {t('auth.loginBtn')}
        </Button>
      </form>
    </AuthShell>
  )
}
