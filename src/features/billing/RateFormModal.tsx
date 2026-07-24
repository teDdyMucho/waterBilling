import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setRate } from '@/features/billing/billing-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'
import type { RateKind } from '@/types/domain'

const TODAY_FALLBACK = '2026-01-01'

export function RateFormModal({
  open,
  onClose,
  kind,
  today,
}: {
  open: boolean
  onClose: () => void
  kind: RateKind
  today: string
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    rate_per_unit: '',
    minimum_charge: '',
    fixed_amount: '',
    penalty_percent: '',
    penalty_fixed: '',
    effective_from: today || TODAY_FALLBACK,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setForm((f) => ({ ...f, effective_from: today || TODAY_FALLBACK }))
    }
  }, [open, today])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () =>
      setRate({
        kind,
        rate_per_unit: Number(form.rate_per_unit) || 0,
        minimum_charge: Number(form.minimum_charge) || 0,
        fixed_amount: Number(form.fixed_amount) || 0,
        penalty_percent: Number(form.penalty_percent) || 0,
        penalty_fixed: Number(form.penalty_fixed) || 0,
        effective_from: form.effective_from,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates'] })
      onClose()
    },
    onError: () => setError(t('common.somethingWrong')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  const title = t(`billing.${kind === 'assoc_dues' ? 'dues' : kind}`)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('billing.setRate')} — ${title}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="rate-form" loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="rate-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {(kind === 'water' || kind === 'electric') && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.0001"
              label={`${t('billing.ratePerUnit')} (₱)`}
              value={form.rate_per_unit}
              onChange={set('rate_per_unit')}
              autoFocus
            />
            <Input
              type="number"
              step="0.01"
              label={`${t('billing.minCharge')} (₱)`}
              value={form.minimum_charge}
              onChange={set('minimum_charge')}
            />
          </div>
        )}

        {kind === 'assoc_dues' && (
          <Input
            type="number"
            step="0.01"
            label={`${t('billing.fixedAmount')} (₱)`}
            value={form.fixed_amount}
            onChange={set('fixed_amount')}
            autoFocus
          />
        )}

        {kind === 'penalty' && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.01"
              label={t('billing.penaltyPercent')}
              value={form.penalty_percent}
              onChange={set('penalty_percent')}
              autoFocus
            />
            <Input
              type="number"
              step="0.01"
              label={`${t('billing.penaltyFixed')} (₱)`}
              value={form.penalty_fixed}
              onChange={set('penalty_fixed')}
            />
          </div>
        )}

        <Input
          type="date"
          label={t('billing.effectiveFrom')}
          value={form.effective_from}
          onChange={set('effective_from')}
          required
        />
      </form>
    </Modal>
  )
}
