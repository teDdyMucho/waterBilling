import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const STYLES: Record<Tone, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: 'bg-info-50 text-info-700 ring-info-100',
    icon: <Info className="size-5" />,
  },
  success: {
    wrap: 'bg-success-50 text-success-700 ring-success-100',
    icon: <CheckCircle2 className="size-5" />,
  },
  warning: {
    wrap: 'bg-warning-50 text-warning-700 ring-warning-100',
    icon: <TriangleAlert className="size-5" />,
  },
  danger: {
    wrap: 'bg-danger-50 text-danger-700 ring-danger-100',
    icon: <AlertCircle className="size-5" />,
  },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const s = STYLES[tone]
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-input px-3.5 py-3 text-sm ring-1 ring-inset',
        s.wrap,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-current/90')}>{children}</div>}
      </div>
    </div>
  )
}
