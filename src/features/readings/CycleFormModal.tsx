import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCycle } from '@/features/readings/readings-api'
import { fetchProperties } from '@/features/properties/properties-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'
import { lotLabel } from '@/lib/format'

export function CycleFormModal({
  open,
  onClose,
  propertyId,
}: {
  open: boolean
  onClose: () => void
  /** Kung may napiling homeowner sa page, ito na ang nakatakda. */
  propertyId?: string | null
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    property_id: '',
    reading_start: '',
    reading_end: '',
    due_date: '',
    status: 'open' as 'open' | 'reading' | 'billed' | 'closed',
  })

  // Isang cycle = isang property, kaya kailangang mapili kung kanino.
  const { data: properties } = useQuery({ queryKey: ['properties'], queryFn: fetchProperties })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setForm({
        property_id: propertyId ?? '',
        reading_start: '',
        reading_end: '',
        due_date: '',
        status: 'open',
      })
    }
  }, [open, propertyId])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // ------------------------------------------------------------------
  //  Awtomatikong cycle code
  //
  //  Kapareho ito ng ginagawa ng trigger para sa susunod na buwan
  //  (migration 0026): "YYYY-MM · Blk <block> Lot <lot>". Kaya kung ano ang
  //  anyo ng una, iyon din ang susunod — hindi na magbabago ang pangalan
  //  pagdating ng auto-cycle.
  // ------------------------------------------------------------------
  const chosen = (properties ?? []).find((p) => p.id === form.property_id) ?? null
  const monthOf = form.reading_start || form.due_date
  const code = chosen
    ? `${(monthOf || new Date().toISOString()).slice(0, 7)} · Blk ${chosen.block} Lot ${chosen.lot}`
    : ''

  const mutation = useMutation({
    mutationFn: () =>
      createCycle({
        code,
        property_id: form.property_id,
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
    if (!form.property_id) return setError(t('readings.pickPropertyHint'))
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
        {/* Kanino ang cycle na ito — kailangan bago mag-save */}
        <Select
          label={`${t('readings.forProperty')} *`}
          value={form.property_id}
          onChange={set('property_id')}
        >
          <option value="">{t('readings.pickProperty')}</option>
          {(properties ?? []).map((p) => {
            const owner = p.owners?.find((o) => !o.end_date)?.profile?.full_name
            return (
              <option key={p.id} value={p.id}>
                {lotLabel(p.block, p.lot)}
                {owner ? ` — ${owner}` : ''}
              </option>
            )
          })}
        </Select>

        {/* Hindi na ito tina-type — kusang binubuo mula sa property at
            buwan, para tugma sa gagawin ng auto-cycle sa susunod. */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('readings.cycleCode')}
          </label>
          <div className="flex h-11 items-center rounded-input border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
            {code || t('readings.codeAfterPick')}
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
