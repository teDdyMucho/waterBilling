import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { AuthShell } from '@/features/auth/AuthShell'
import { sendPasswordReset } from '@/features/auth/auth-api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'

export default function ForgotPasswordPage() {
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await sendPasswordReset(email)
    } catch {
      // Sinasadyang hindi ibunyag kung umiiral ang email (seguridad).
    } finally {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSub')}
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          {t('auth.loginLink')}
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success" title={t('auth.forgotSent')} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
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
          <Button type="submit" block size="lg" loading={loading}>
            {t('auth.forgotBtn')}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
