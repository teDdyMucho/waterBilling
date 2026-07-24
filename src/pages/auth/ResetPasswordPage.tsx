import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '@/features/auth/AuthShell'
import { updatePassword } from '@/features/auth/auth-api'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'

export default function ResetPasswordPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError(t('auth.passwordTooShort'))
    if (password !== confirm) return setError(t('auth.passwordMismatch'))

    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch {
      setError(t('common.somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSub')}
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          {t('auth.loginLink')}
        </Link>
      }
    >
      {done ? (
        <Alert tone="success" title={t('auth.resetDone')} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <PasswordInput
            label={t('auth.newPassword')}
            hint={t('auth.passwordHint')}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordInput
            label={t('auth.confirmPassword')}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" block size="lg" loading={loading}>
            {t('auth.resetBtn')}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
