import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Phone, ShieldCheck, User } from 'lucide-react'
import { provisionUser } from '@/features/admin/admin-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'

export function AddAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    contact: '',
    password: '',
    role: 'staff' as 'staff' | 'admin',
    zone: '',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function reset() {
    setForm({ fullName: '', email: '', contact: '', password: '', role: 'staff', zone: '' })
    setError(null)
  }

  const mutation = useMutation({
    mutationFn: () =>
      provisionUser({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        contactNumber: form.contact,
        role: form.role,
        zone: form.zone,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-profiles'] })
      qc.invalidateQueries({ queryKey: ['pending-profiles'] })
      reset()
      onClose()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      setError(
        /already registered|already in use|exists/i.test(msg)
          ? t('accounts.emailInUse')
          : t('common.somethingWrong'),
      )
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password.length < 8) return setError(t('auth.passwordTooShort'))
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={t('accounts.addTitle')}
      description={t('accounts.addDesc')}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="add-account-form"
            loading={mutation.isPending}
            iconLeft={<ShieldCheck className="size-4" />}
          >
            {t('accounts.createStaff')}
          </Button>
        </>
      }
    >
      <form id="add-account-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Select label={t('accounts.roleField')} value={form.role} onChange={set('role')}>
          <option value="staff">{t('accounts.roleStaff')}</option>
          <option value="admin">{t('accounts.roleAdmin')}</option>
        </Select>

        {form.role === 'staff' && (
          <Input
            label={t('accounts.zone')}
            placeholder={t('accounts.zonePh')}
            value={form.zone}
            onChange={set('zone')}
          />
        )}

        <Input
          label={t('auth.fullName')}
          placeholder={t('auth.fullNamePh')}
          iconLeft={<User className="size-4" />}
          required
          value={form.fullName}
          onChange={set('fullName')}
        />
        <Input
          type="email"
          label={t('auth.email')}
          placeholder={t('auth.emailPh')}
          iconLeft={<Mail className="size-4" />}
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
          inputMode="tel"
          value={form.contact}
          onChange={set('contact')}
        />
        <PasswordInput
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
        />
      </form>
    </Modal>
  )
}
