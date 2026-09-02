import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

/**
 * In-app na confirm dialog — kapalit ng pangit na native na window.confirm.
 * Bagay sa monochrome na disenyo; may pulang accent kapag destructive.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  message: ReactNode
  confirmLabel: string
  cancelLabel: string
  /** Pulang destructive na confirm button (hal. delete). */
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={onConfirm}
            className={danger ? 'bg-red-600 ring-red-600 hover:bg-red-600/90 active:bg-red-700' : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <TriangleAlert className="size-5" />
          </span>
        )}
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </Modal>
  )
}
