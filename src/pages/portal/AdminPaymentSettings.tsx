import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QrCode, Upload } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import {
  fetchPaymentSettings,
  updatePaymentSettings,
  uploadQr,
} from '@/features/payments/payments-api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PageLoader } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'

export default function AdminPaymentSettings() {
  const { t } = useT()
  const qc = useQueryClient()
  const qrRef = useRef<HTMLInputElement>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: fetchPaymentSettings,
  })

  const [form, setForm] = useState({
    gcash_number: '',
    gcash_name: '',
    maya_number: '',
    maya_name: '',
    bank_name: '',
    bank_account: '',
    bank_account_name: '',
    instructions: '',
  })
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [uploadingQr, setUploadingQr] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        gcash_number: settings.gcash_number ?? '',
        gcash_name: settings.gcash_name ?? '',
        maya_number: settings.maya_number ?? '',
        maya_name: settings.maya_name ?? '',
        bank_name: settings.bank_name ?? '',
        bank_account: settings.bank_account ?? '',
        bank_account_name: settings.bank_account_name ?? '',
        instructions: settings.instructions ?? '',
      })
    }
  }, [settings])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => updatePaymentSettings(form),
    onSuccess: () => {
      setMsg(t('payments.settingsSaved'))
      qc.invalidateQueries({ queryKey: ['payment-settings'] })
    },
    onError: () => setErr(t('common.somethingWrong')),
  })

  async function onQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    setUploadingQr(true)
    try {
      await uploadQr(file)
      qc.invalidateQueries({ queryKey: ['payment-settings'] })
    } catch {
      setErr(t('common.somethingWrong'))
    } finally {
      setUploadingQr(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    save.mutate()
  }

  if (isLoading) return <PageLoader />

  return (
    <AppShell>
      <PageHeader title={t('payments.settingsTitle')} description={t('payments.settingsSub')} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* Channels */}
        <Card>
          <CardHeader title={t('payments.channels')} />
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-4">
              {err && <Alert tone="danger">{err}</Alert>}
              {msg && <Alert tone="success">{msg}</Alert>}

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t('payments.gcashNumber')} value={form.gcash_number} onChange={set('gcash_number')} />
                <Input label={t('payments.gcashName')} value={form.gcash_name} onChange={set('gcash_name')} />
                <Input label={t('payments.mayaNumber')} value={form.maya_number} onChange={set('maya_number')} />
                <Input label={t('payments.mayaName')} value={form.maya_name} onChange={set('maya_name')} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t('payments.bankName')} value={form.bank_name} onChange={set('bank_name')} />
                <Input label={t('payments.bankAccountName')} value={form.bank_account_name} onChange={set('bank_account_name')} />
                <Input label={t('payments.bankAccount')} value={form.bank_account} onChange={set('bank_account')} className="sm:col-span-2" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('payments.instructions')}
                </label>
                <textarea
                  value={form.instructions}
                  onChange={set('instructions')}
                  rows={3}
                  className="w-full rounded-input border border-slate-300 px-3 py-2 text-slate-900 shadow-xs focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <Button type="submit" loading={save.isPending}>
                {t('payments.saveSettings')}
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* QR */}
        <Card>
          <CardHeader title={t('payments.qr')} />
          <CardBody className="flex flex-col items-center gap-4">
            {settings?.qr_path ? (
              <img src={settings.qr_path} alt="QR" className="size-48 rounded-lg border border-slate-200 object-contain" />
            ) : (
              <div className="grid size-48 place-items-center rounded-lg border-2 border-dashed border-slate-300 text-slate-300">
                <QrCode className="size-16" />
              </div>
            )}
            <input ref={qrRef} type="file" accept="image/*" className="hidden" onChange={onQr} />
            <Button
              variant="outline"
              block
              loading={uploadingQr}
              onClick={() => qrRef.current?.click()}
              iconLeft={<Upload className="size-4" />}
            >
              {settings?.qr_path ? t('payments.changeQr') : t('payments.uploadQr')}
            </Button>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}
