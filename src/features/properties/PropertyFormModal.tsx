import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProperty, updateProperty } from '@/features/properties/properties-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'
import type { Property, PropertyStatus } from '@/types/domain'

const EMPTY = {
  block: '',
  lot: '',
  phase: '',
  address_line: '',
  assigned_zone: '',
  status: 'occupied' as PropertyStatus,
  notes: '',
}

export function PropertyFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Property | null
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setForm(
        editing
          ? {
              block: editing.block,
              lot: editing.lot,
              phase: editing.phase ?? '',
              address_line: editing.address_line ?? '',
              assigned_zone: editing.assigned_zone ?? '',
              status: editing.status,
              notes: editing.notes ?? '',
            }
          : { ...EMPTY },
      )
    }
  }, [open, editing])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        block: form.block.trim(),
        lot: form.lot.trim(),
        phase: form.phase.trim() || null,
        address_line: form.address_line.trim() || null,
        assigned_zone: form.assigned_zone.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      }
      if (editing) await updateProperty(editing.id, payload)
      else await createProperty(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] })
      qc.invalidateQueries({ queryKey: ['property', editing?.id] })
      onClose()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      setError(
        /duplicate|unique/i.test(msg)
          ? 'May ganitong block/lot na. Pakisuri.'
          : t('common.somethingWrong'),
      )
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
      title={editing ? t('properties.editTitle') : t('properties.addTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="property-form" loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="property-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('properties.block')} required value={form.block} onChange={set('block')} />
          <Input label={t('properties.lot')} required value={form.lot} onChange={set('lot')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('properties.phase')} value={form.phase} onChange={set('phase')} />
          <Input label={t('properties.zone')} value={form.assigned_zone} onChange={set('assigned_zone')} />
        </div>
        <Input
          label={t('properties.address')}
          value={form.address_line}
          onChange={set('address_line')}
        />
        <Select label={t('properties.status')} value={form.status} onChange={set('status')}>
          <option value="occupied">{t('properties.occupied')}</option>
          <option value="vacant">{t('properties.vacant')}</option>
          <option value="inactive">{t('properties.inactive')}</option>
        </Select>
        <Input label={t('properties.notes')} value={form.notes} onChange={set('notes')} />
      </form>
    </Modal>
  )
}
