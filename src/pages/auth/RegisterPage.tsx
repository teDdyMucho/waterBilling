import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Phone, User } from 'lucide-react'
import { AuthShell } from '@/features/auth/AuthShell'
import { registerHomeowner } from '@/features/auth/auth-api'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Select, Checkbox } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'
import type { Language } from '@/types/domain'

export default function RegisterPage() {
  const { t, locale } = useT()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    contact: '',
    block: '',
    lot: '',
    password: '',
    confirm: '',
    language: locale as Language,
  })
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password.length < 8) return setError(t('auth.passwordTooShort'))
    if (form.password !== form.confirm) return setError(t('auth.passwordMismatch'))
    if (!consent) return setError(t('auth.mustConsent'))

    setLoading(true)
    try {
      await registerHomeowner({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        contactNumber: form.contact,
        block: form.block,
        lot: form.lot,
        language: form.language,
      })
      // Naka-off ang email confirm → agad may session → RequireAuth → /pending
      navigate('/pending', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        /already registered|already in use/i.test(msg)
          ? t('auth.emailInUse')
          : t('common.somethingWrong'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSub')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
            {t('auth.loginLink')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Input
          label={t('auth.fullName')}
          placeholder={t('auth.fullNamePh')}
          iconLeft={<User className="size-4" />}
          autoComplete="name"
          required
          value={form.fullName}
          onChange={set('fullName')}
        />

        <Input
          type="email"
          label={t('auth.email')}
          placeholder={t('auth.emailPh')}
          iconLeft={<Mail className="size-4" />}
          autoComplete="email"
          inputMode="email"
          required
          value={form.email}
          onChange={set('email')}
        />

        <Input
          type="tel"
          label={t('auth.contact')}
          placeholder={t('auth.contactPh')}
          iconLeft={<Phone className="size-4" />}
          autoComplete="tel"
          inputMode="tel"
          required
          value={form.contact}
          onChange={set('contact')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('auth.block')}
            placeholder={t('auth.blockPh')}
            required
            value={form.block}
            onChange={set('block')}
          />
          <Input
            label={t('auth.lot')}
            placeholder={t('auth.lotPh')}
            required
            value={form.lot}
            onChange={set('lot')}
          />
        </div>

        <PasswordInput
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
        />

        <PasswordInput
          label={t('auth.confirmPassword')}
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set('confirm')}
        />

        <Select
          label={t('auth.language')}
          value={form.language}
          onChange={set('language')}
        >
          <option value="tl">Tagalog</option>
          <option value="en">English</option>
        </Select>

        <Checkbox
          label={t('auth.consent')}
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />

        <Button type="submit" block size="lg" loading={loading}>
          {t('auth.registerBtn')}
        </Button>
      </form>
    </AuthShell>
  )
}
