import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Check, Copy, Info, Landmark, QrCode, Wallet } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { fetchPaymentSettings } from '@/features/payments/payments-api'
import { useT } from '@/hooks/useT'

/**
 * Gabay sa Pagbabayad — para sa homeowner: kung paano bayaran ang bill.
 * Binabasa ang TOTOONG payment settings (channels + QR + tagubilin ng admin) —
 * walang imbentong data.
 */
export default function PaymentGuide() {
  const { t } = useT()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: fetchPaymentSettings,
  })

  const hasGcash = Boolean(settings?.gcash_number)
  const hasMaya = Boolean(settings?.maya_number)
  const hasBank = Boolean(settings?.bank_account)
  const noChannels = !isLoading && !hasGcash && !hasMaya && !hasBank && !settings?.qr_path

  const steps = [
    t('payGuide.step1'),
    t('payGuide.step2'),
    t('payGuide.step3'),
    t('payGuide.step4'),
    t('payGuide.step5'),
  ]
  const rules = [t('payGuide.rule1'), t('payGuide.rule2'), t('payGuide.rule3'), t('payGuide.rule4')]

  return (
    <AppShell>
      <PageHeader title={t('payGuide.title')} description={t('payGuide.subHomeowner')} />

      <div className="mx-auto max-w-3xl space-y-5">
        {/* ---- Steps ---- */}
        <Card>
          <CardHeader title={t('payGuide.stepsTitle')} />
          <CardBody>
            <ol className="space-y-3.5">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-sm text-slate-700">{s}</p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        {/* ---- Channels ---- */}
        <Card>
          <CardHeader title={t('payGuide.channelsTitle')} description={t('payGuide.channelsSub')} />
          <CardBody className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                {hasGcash && (
                  <ChannelCard
                    icon={<Wallet className="size-5" />}
                    name={t('payments.m_gcash')}
                    fields={[
                      { label: t('payGuide.number'), value: settings!.gcash_number!, copyable: true },
                      { label: t('payGuide.accountName'), value: settings!.gcash_name ?? '—' },
                    ]}
                  />
                )}
                {hasMaya && (
                  <ChannelCard
                    icon={<Wallet className="size-5" />}
                    name={t('payments.m_maya')}
                    fields={[
                      { label: t('payGuide.number'), value: settings!.maya_number!, copyable: true },
                      { label: t('payGuide.accountName'), value: settings!.maya_name ?? '—' },
                    ]}
                  />
                )}
                {hasBank && (
                  <ChannelCard
                    icon={<Landmark className="size-5" />}
                    name={t('payments.m_bank_transfer')}
                    fields={[
                      { label: t('payGuide.bankLabel'), value: settings!.bank_name ?? '—' },
                      { label: t('payGuide.accountName'), value: settings!.bank_account_name ?? '—' },
                      { label: t('payGuide.accountNumber'), value: settings!.bank_account!, copyable: true },
                    ]}
                  />
                )}

                {/* Cash — laging available */}
                <ChannelCard
                  icon={<Banknote className="size-5" />}
                  name={t('payGuide.cashTitle')}
                  note={t('payGuide.cashNote')}
                />

                {/* QR */}
                {settings?.qr_path && (
                  <div className="flex flex-col items-center gap-2 rounded-card border border-slate-200 p-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <QrCode className="size-4" /> {t('payGuide.qrTitle')}
                    </p>
                    <img
                      src={settings.qr_path}
                      alt="QR"
                      className="size-48 rounded-lg border border-slate-200 object-contain"
                    />
                  </div>
                )}

                {noChannels && <Alert tone="warning">{t('payGuide.notSet')}</Alert>}
              </>
            )}
          </CardBody>
        </Card>

        {/* ---- Rules + admin note ---- */}
        <Card>
          <CardHeader title={t('payGuide.rulesTitle')} />
          <CardBody>
            <ul className="space-y-2.5">
              {rules.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-700" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>

            {settings?.instructions && (
              <div className="mt-4 rounded-input bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Info className="size-4 text-brand-700" /> {t('payGuide.adminNote')}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                  {settings.instructions}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------

type Field = { label: string; value: string; copyable?: boolean }

function ChannelCard({
  icon,
  name,
  fields,
  note,
}: {
  icon: React.ReactNode
  name: string
  fields?: Field[]
  note?: string
}) {
  return (
    <div className="rounded-card border border-slate-200 p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
          {icon}
        </span>
        <p className="text-sm font-semibold text-slate-900">{name}</p>
      </div>
      {note && <p className="mt-2 text-sm text-slate-600">{note}</p>}
      {fields && (
        <dl className="mt-3 space-y-2">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between gap-3">
              <dt className="text-xs text-slate-500">{f.label}</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-900">{f.value}</span>
                {f.copyable && <CopyButton value={f.value} />}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      aria-label={t('payGuide.copy')}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-brand-700" /> {t('payGuide.copied')}
        </>
      ) : (
        <>
          <Copy className="size-3.5" /> {t('payGuide.copy')}
        </>
      )}
    </button>
  )
}
