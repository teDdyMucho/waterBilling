import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Droplets, Zap } from 'lucide-react'
import {
  createPropertyWithAccount,
  type NewPropertyAccount,
} from '@/features/properties/properties-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'

/**
 * Bagong lote na wala pa sa listahan. Sa pag-save, gumagawa ito ng
 * property, metro, AT homeowner account nang sabay (migration 0029).
 *
 * WALANG pangalan dito — ang homeowner mismo ang maglalagay niyon sa
 * unang login niya, gamit ang link na ibibigay ng staff.
 */
export function NewPropertyAccountModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  /** Tinatawag kapag nagawa na — para makapili agad ng bagong property. */
  onCreated?: (result: NewPropertyAccount) => void
}) {
  const { t } = useT()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    block: '',
    lot: '',
    waterMeter: '',
    electricMeter: '',
    installedAt: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<NewPropertyAccount | null>(null)

  useEffect(() => {
    if (open) {
      setForm({ block: '', lot: '', waterMeter: '', electricMeter: '', installedAt: '' })
      setError(null)
      setCreated(null)
    }
  }, [open])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () =>
      createPropertyWithAccount({
        block: form.block,
        lot: form.lot,
        waterMeter: form.waterMeter,
        electricMeter: form.electricMeter,
        installedAt: form.installedAt || null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['properties'] })
      qc.invalidateQueries({ queryKey: ['all-profiles'] })
      qc.invalidateQueries({ queryKey: ['open-worklist'] })
      setCreated(res)
      onCreated?.(res)
    },
    onError: (e) => setError(e instanceof Error ? e.message : t('common.somethingWrong')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.block.trim() || !form.lot.trim()) return setError(t('common.required'))
    mutation.mutate()
  }

  // Nagawa na — ipakita ang credentials para maipadala agad.
  if (created) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={t('properties.accountReady')}
        description={t('properties.accountReadySub')}
        footer={<Button onClick={onClose}>{t('common.close')}</Button>}
      >
        <CredentialsBlock email={created.email} password={created.password} />
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('properties.addTitle')}
      description={t('properties.addAccountNote')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="new-property-form" loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="new-property-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`${t('auth.block')} *`}
            placeholder="e.g. 1"
            required
            value={form.block}
            onChange={set('block')}
            autoFocus
          />
          <Input
            label={`${t('auth.lot')} *`}
            placeholder="e.g. 27"
            required
            value={form.lot}
            onChange={set('lot')}
          />
        </div>

        <Input
          label={t('properties.waterMeterNo')}
          placeholder="e.g. WM-001234"
          iconLeft={<Droplets className="size-4" />}
          value={form.waterMeter}
          onChange={set('waterMeter')}
        />
        <Input
          label={t('properties.electricMeterNo')}
          placeholder="e.g. EM-001234"
          iconLeft={<Zap className="size-4" />}
          value={form.electricMeter}
          onChange={set('electricMeter')}
        />
        <Input
          type="date"
          label={t('properties.installedAt')}
          value={form.installedAt}
          onChange={set('installedAt')}
        />
      </form>
    </Modal>
  )
}

/** Link, email, at password — kopyahin at ipadala sa homeowner. */
export function CredentialsBlock({ email, password }: { email: string; password: string }) {
  const { t } = useT()
  const link = `${window.location.origin}/login`
  const message = `${t('properties.shareIntro')}\n\n${link}\n${t('auth.email')}: ${email}\n${t('auth.password')}: ${password}`

  return (
    <div className="space-y-3">
      <Field label={t('properties.appLink')} value={link} />
      <Field label={t('auth.email')} value={email} />
      <Field label={t('auth.password')} value={password} />

      <CopyButton text={message} label={t('properties.copyAll')} block />

      <p className="text-xs text-slate-500">{t('properties.shareNote')}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate rounded-input border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
          {value}
        </div>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

function CopyButton({
  text,
  label,
  block = false,
}: {
  text: string
  label?: string
  block?: boolean
}) {
  const { t } = useT()
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      // Ang clipboard ay hinaharangan sa ilang browser — huwag magpakita
      // ng "nakopya" kung hindi naman totoo.
      setDone(false)
    }
  }

  return (
    <Button
      type="button"
      variant={block ? 'primary' : 'outline'}
      block={block}
      onClick={copy}
      iconLeft={done ? <Check className="size-4" /> : <Copy className="size-4" />}
    >
      {done ? t('properties.copied') : (label ?? t('common.copy'))}
    </Button>
  )
}
