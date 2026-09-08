import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createMeter, replaceMeter, updateMeter } from '@/features/properties/properties-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'
import type { Meter, UtilityType } from '@/types/domain'

export function MeterFormModal({
  open,
  onClose,
  propertyId,
  utility,
  editing,
  replacing,
}: {
  open: boolean
  onClose: () => void
  propertyId: string
  utility: UtilityType
  editing?: Meter | null
  /** Kung set, gagawa ng BAGO at markahang 'replaced' ang lumang metro. */
  replacing?: Meter | null
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    meter_number: '',
    installed_at: '',
  })
  const [error, setError] = useState<string | null>(null)

  // Hindi na ini-input ang initial_reading at digits — default na lang (0 / 5).
  // Sa EDIT, pinapanatili ang naka-save na halaga para hindi ma-zero ang
  // baseline ng metrong may bill na.
  const initialReading = editing?.initial_reading ?? 0
  const digits = editing?.digits ?? replacing?.digits ?? 5

  useEffect(() => {
    if (open) {
      setError(null)
      setForm({
        meter_number: editing?.meter_number ?? '',
        installed_at: editing?.installed_at ?? '',
      })
    }
  }, [open, editing, replacing])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: async () => {
      if (replacing) {
        await replaceMeter({
          oldMeterId: replacing.id,
          meterNumber: form.meter_number.trim() || null,
          initialReading: 0,
          digits,
          installedAt: form.installed_at || null,
        })
        return
      }
      const payload = {
        property_id: propertyId,
        utility_type: utility,
        meter_number: form.meter_number.trim() || null,
        initial_reading: initialReading,
        digits,
        installed_at: form.installed_at || null,
      }
      if (editing) await updateMeter(editing.id, payload)
      else await createMeter(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property', propertyId] })
      qc.invalidateQueries({ queryKey: ['properties'] })
      onClose()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      setError(
        /duplicate|unique/i.test(msg)
          ? 'Gamit na ang meter number na ito.'
          : t('common.somethingWrong'),
      )
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  const label = utility === 'water' ? t('properties.water') : t('properties.electric')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${
        replacing
          ? t('properties.replaceMeter')
          : editing
            ? t('properties.editMeter')
            : t('properties.addMeter')
      } — ${label}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="meter-form" loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="meter-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {replacing && <Alert tone="warning">{t('properties.replaceNote')}</Alert>}
        <Input
          label={t('properties.meterNumber')}
          value={form.meter_number}
          onChange={set('meter_number')}
          placeholder="e.g. WM-001234"
        />
        <Input
          type="date"
          label={t('properties.installedAt')}
          value={form.installed_at}
          onChange={set('installed_at')}
        />
      </form>
    </Modal>
  )
}
