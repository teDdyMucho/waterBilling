import { useState } from 'react'
import { initials } from '@/lib/format'
import { cn } from '@/lib/cn'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<Size, string> = {
  sm: 'size-8 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl',
}

/**
 * Avatar: ipinapakita ang profile IMAGE kung meron; kung wala (o bigo
 * ang load), ang INITIALS ang fallback. Ang `className` ay puwedeng
 * mag-override ng background ng initials (hal. bg-slate-400).
 */
export function Avatar({
  url,
  name,
  size = 'md',
  className,
}: {
  url?: string | null
  name?: string | null
  size?: Size
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name ?? 'avatar'}
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full bg-slate-100 object-cover', SIZES[size], className)}
      />
    )
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-brand-700 font-semibold text-white',
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
