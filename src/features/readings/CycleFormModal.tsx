import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCycle } from '@/features/readings/readings-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'

export function CycleFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    code: '',
    reading_start: '',
    reading_end: '',
    bill_date: '',
    due_date: '',
    grace_days: '5',
    status: 'open' as 'open' | 'reading' | 'billed' | 'closed',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setForm({
        code: '',
        reading_start: '',
        reading_end: '',
        bill_date: '',
        due_date: '',
        grace_days: '5',
        status: 'open',
      })
    }
  }, [open])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () =>
      createCycle({
        code: form.code.trim(),
        reading_start: form.reading_start || null,
        reading_end: form.reading_end || null,
        bill_date: form.bill_date || null,
        due_date: form.due_date || null,
        grace_days: Number(form.grace_days) || 5,
        status: form.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycles'] })
      qc.invalidateQueries({ queryKey: ['active-cycle'] })
      onClose()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      setError(/duplicate|unique/i.test(msg) ? 'May ganitong cycle code na.' : t('common.somethingWrong'))
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.code.trim()) return setError(t('common.required'))
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('readings.newCycle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="cycle-form" loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="cycle-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Input
          label={t('readings.cycleCode')}
          placeholder={t('readings.cycleCodePh')}
          required
          value={form.code}
          onChange={set('code')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t('readings.readingStart')} value={form.reading_start} onChange={set('reading_start')} />
          <Input type="date" label={t('readings.readingEnd')} value={form.reading_end} onChange={set('reading_end')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t('readings.billDate')} value={form.bill_date} onChange={set('bill_date')} />
          <Input type="date" label={t('readings.dueDate')} value={form.due_date} onChange={set('due_date')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" label={t('readings.graceDays')} value={form.grace_days} onChange={set('grace_days')} />
          <Select label={t('readings.cycleStatus')} value={form.status} onChange={set('status')}>
            <option value="open">{t('readings.statusOpen')}</option>
            <option value="reading">{t('readings.statusReading')}</option>
            <option value="billed">{t('readings.statusBilled')}</option>
            <option value="closed">{t('readings.statusClosed')}</option>
          </Select>
        </div>
      </form>
    </Modal>
  )
}
