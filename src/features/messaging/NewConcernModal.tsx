import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Paperclip, X } from 'lucide-react'
import { createThread } from '@/features/messaging/messaging-api'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/hooks/useT'
import type { ThreadCategory } from '@/types/domain'

const CATS: ThreadCategory[] = ['billing', 'meter', 'requirements', 'complaint', 'others']

export function NewConcernModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<ThreadCategory>('billing')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setSubject('')
    setCategory('billing')
    setBody('')
    setFiles([])
    setError(null)
  }

  const mutation = useMutation({
    mutationFn: () =>
      createThread({ subject, category, body, openedBy: user!.id, files }),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['my-threads'] })
      reset()
      onClose()
      navigate(`/dashboard/messages/${id}`)
    },
    onError: () => setError(t('common.somethingWrong')),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!subject.trim() || !body.trim()) return setError(t('common.required'))
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={t('messaging.newTitle')}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="concern-form" loading={mutation.isPending}>
            {t('messaging.send')}
          </Button>
        </>
      }
    >
      <form id="concern-form" onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Select label={t('messaging.category')} value={category} onChange={(e) => setCategory(e.target.value as ThreadCategory)}>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {t(`messaging.cat_${c}`)}
            </option>
          ))}
        </Select>
        <Input
          label={t('messaging.subject')}
          placeholder={t('messaging.subjectPh')}
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('messaging.message')}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('messaging.messagePh')}
            rows={4}
            required
            className="w-full rounded-input border border-slate-300 px-3 py-2 text-slate-900 shadow-xs focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-input border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50/40">
            <Paperclip className="size-4" />
            {t('messaging.attach')}
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {f.name}
                  <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
