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
    reading_start: '',
    reading_end: '',
    due_date: '',
    status: 'open' as 'open' | 'reading' | 'billed' | 'closed',
  })

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setForm({
        reading_start: '',
        reading_end: '',
        due_date: '',
        status: 'open',
      })
    }
  }, [open])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // ------------------------------------------------------------------
  //  Awtomatikong cycle code — YYYY-MM ng reading start.
  //  Kapareho ito ng ginagawa ng auto-next-cycle na trigger (0030), kaya
  //  pare-pareho ang anyo ng una at ng mga susunod.
  // ------------------------------------------------------------------
  const monthOf = form.reading_start || form.due_date
  const code = (monthOf || new Date().toISOString()).slice(0, 7)

  const mutation = useMutation({
    mutationFn: () =>
      createCycle({
        code,
        reading_start: form.reading_start || null,
        reading_end: form.reading_end || null,
        // Wala nang input ang bill_date at grace_days — default na lang:
        // bill_date null = current date ang gamit sa pagpili ng rate,
        // grace_days 5   = ang default ng database.
        bill_date: null,
        due_date: form.due_date || null,
        grace_days: 5,
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
        {/* Hindi na ito tina-type — kusang binubuo mula sa property at
            buwan, para tugma sa gagawin ng auto-cycle sa susunod. */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('readings.cycleCode')}
          </label>
          <div className="flex h-11 items-center rounded-input border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
            {code}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t('readings.readingStart')} value={form.reading_start} onChange={set('reading_start')} />
          <Input type="date" label={t('readings.readingEnd')} value={form.reading_end} onChange={set('reading_end')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t('readings.dueDate')} value={form.due_date} onChange={set('due_date')} />
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
