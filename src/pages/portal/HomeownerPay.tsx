import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  CreditCard,
  ReceiptText,
  Smartphone,
  Upload,
} from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { fetchBill } from '@/features/billing/billing-api'
import { fetchPaymentSettings, submitPayment } from '@/features/payments/payments-api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import { money } from '@/lib/format'
import type { PaymentMethod } from '@/types/domain'

export default function HomeownerPay() {
  const { t } = useT()
  const { billId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: bill, isLoading } = useQuery({
    queryKey: ['bill', billId],
    queryFn: () => fetchBill(billId),
  })
  const { data: settings } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: fetchPaymentSettings,
  })

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('gcash')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [proof, setProof] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Prefill amount = balance (once loaded)
  if (bill && amount === '') setAmount(String(bill.balance))

  const mutation = useMutation({
    mutationFn: () =>
      submitPayment({
        billId: bill?.id ?? null,
        propertyId: bill?.property_id ?? null,
        submittedBy: user!.id,
        amount: Number(amount),
        method,
        referenceNumber: reference,
        paymentDate: date,
        proof: proof!,
      }),
    onSuccess: () => navigate('/dashboard/payments'),
    onError: () => setError(t('common.somethingWrong')),
  })

  function onProof(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setProof(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!amount || Number(amount) <= 0) return setError(t('common.required'))
    if (!proof) return setError(t('payments.proofRequired'))
    mutation.mutate()
  }

  if (isLoading) return <PageLoader />

  return (
    <AppShell>
      <Link
        to={bill ? `/dashboard/bills/${bill.id}` : '/dashboard/bills'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        {t('billing.backToBills')}
      </Link>
      <PageHeader title={t('payments.payTitle')} description={t('payments.paySub')} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Channels + QR */}
        <Card>
          <CardHeader title={t('payments.channels')} />
          <CardBody className="space-y-4">
            {settings?.qr_path && (
              <div className="flex flex-col items-center rounded-input bg-slate-50 p-4">
                <img src={settings.qr_path} alt="QR" className="size-48 rounded-lg object-contain" />
                <p className="mt-2 text-xs font-medium text-slate-500">{t('payments.scanQr')}</p>
              </div>
            )}
            {settings?.gcash_number && (
              <CopyRow icon={<Smartphone className="size-4" />} label="GCash" value={settings.gcash_number} sub={settings.gcash_name} />
            )}
            {settings?.maya_number && (
              <CopyRow icon={<Smartphone className="size-4" />} label="Maya" value={settings.maya_number} sub={settings.maya_name} />
            )}
            {settings?.bank_account && (
              <CopyRow
                icon={<Building2 className="size-4" />}
                label={settings.bank_name ?? 'Bank'}
                value={settings.bank_account}
                sub={settings.bank_account_name}
              />
            )}
            {settings?.instructions && (
              <Alert tone="info">{settings.instructions}</Alert>
            )}
          </CardBody>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader
            title={bill ? `${bill.bill_no} · ${money(bill.balance)}` : t('payments.amount')}
          />
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}

              <Input
                type="number"
                step="0.01"
                label={`${t('payments.amount')} (₱)`}
                iconLeft={<ReceiptText className="size-4" />}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Select label={t('payments.method')} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <option value="gcash">{t('payments.m_gcash')}</option>
                <option value="maya">{t('payments.m_maya')}</option>
                <option value="bank_transfer">{t('payments.m_bank_transfer')}</option>
              </Select>
              <Input
                label={t('payments.reference')}
                placeholder={t('payments.referencePh')}
                iconLeft={<CreditCard className="size-4" />}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <Input type="date" label={t('payments.date')} value={date} onChange={(e) => setDate(e.target.value)} />

              {/* Proof — REQUIRED */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('payments.proof')} <span className="text-danger-600">*</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onProof} />
                {preview ? (
                  <div className="relative overflow-hidden rounded-input border border-slate-200">
                    <img src={preview} alt="proof" className="max-h-56 w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="absolute right-2 top-2 rounded-md bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur"
                    >
                      {t('payments.changeProof')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-input border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-8 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <Upload className="size-7 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{t('payments.uploadProof')}</span>
                    <span className="text-xs text-slate-400">{t('payments.proofRequired')}</span>
                  </button>
                )}
              </div>

              <Button type="submit" block size="lg" loading={mutation.isPending} disabled={!proof}>
                {mutation.isPending ? t('payments.submitting') : t('payments.submit')}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

function CopyRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string | null
}) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center gap-3 rounded-input border border-slate-200 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="tabular truncate font-semibold text-slate-900">{value}</p>
        {sub && <p className="truncate text-xs text-slate-400">{sub}</p>}
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? t('payments.copied') : t('payments.copy')}
      </button>
    </div>
  )
}
