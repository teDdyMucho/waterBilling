import { useState, type FormEvent } from 'react'
import { Mail, MapPin, Phone, User } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { updateMyProfile, updatePassword } from '@/features/auth/auth-api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'
import type { Language } from '@/types/domain'

export default function HomeownerProfile() {
  const { t } = useT()
  const { profile, user, refreshProfile } = useAuth()

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    contact_number: profile?.contact_number ?? '',
    preferred_language: (profile?.preferred_language ?? 'tl') as Language,
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)

  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setProfileErr(null)
    setProfileMsg(null)
    setSavingProfile(true)
    try {
      await updateMyProfile(user.id, {
        full_name: form.full_name.trim(),
        contact_number: form.contact_number.trim(),
        preferred_language: form.preferred_language,
      })
      await refreshProfile()
      setProfileMsg(t('profile.saved'))
    } catch {
      setProfileErr(t('common.somethingWrong'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setPwErr(null)
    setPwMsg(null)
    if (pw.next.length < 8) return setPwErr(t('auth.passwordTooShort'))
    if (pw.next !== pw.confirm) return setPwErr(t('auth.passwordMismatch'))
    setSavingPw(true)
    try {
      await updatePassword(pw.next)
      setPw({ next: '', confirm: '' })
      setPwMsg(t('profile.passwordUpdated'))
    } catch {
      setPwErr(t('common.somethingWrong'))
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('profile.title')} description={t('profile.sub')} />

      <div className="mx-auto max-w-2xl space-y-5">
        {/* Editable details */}
        <Card>
          <CardHeader title={t('profile.title')} />
          <CardBody>
            <form onSubmit={saveProfile} className="space-y-4">
              {profileErr && <Alert tone="danger">{profileErr}</Alert>}
              {profileMsg && <Alert tone="success">{profileMsg}</Alert>}

              <Input
                label={t('profile.fullName')}
                iconLeft={<User className="size-4" />}
                value={form.full_name}
                onChange={set('full_name')}
              />
              <Input
                type="tel"
                label={t('profile.contact')}
                iconLeft={<Phone className="size-4" />}
                value={form.contact_number}
                onChange={set('contact_number')}
              />
              <Select
                label={t('profile.language')}
                value={form.preferred_language}
                onChange={set('preferred_language')}
              >
                <option value="tl">Tagalog</option>
                <option value="en">English</option>
              </Select>

              {/* Read-only */}
              <div className="grid grid-cols-1 gap-3 rounded-input bg-slate-50 p-3.5 sm:grid-cols-2">
                <ReadOnly icon={<Mail className="size-4" />} label={t('profile.email')} value={user?.email ?? '—'} />
                <ReadOnly
                  icon={<MapPin className="size-4" />}
                  label={t('profile.lot')}
                  value={lotLabel(profile?.block, profile?.lot)}
                />
              </div>
              <p className="text-xs text-slate-400">{t('profile.readonly')}</p>

              <Button type="submit" loading={savingProfile}>
                {t('profile.save')}
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader title={t('profile.changePassword')} />
          <CardBody>
            <form onSubmit={savePassword} className="space-y-4">
              {pwErr && <Alert tone="danger">{pwErr}</Alert>}
              {pwMsg && <Alert tone="success">{pwMsg}</Alert>}
              <PasswordInput
                label={t('profile.newPassword')}
                hint={t('auth.passwordHint')}
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
              <PasswordInput
                label={t('profile.confirmPassword')}
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
              <Button type="submit" variant="secondary" loading={savingPw}>
                {t('profile.updatePassword')}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

function ReadOnly({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  )
}
