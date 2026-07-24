import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-brand ring-1 ring-inset ring-white/10 hover:from-brand-600 hover:to-brand-800 active:to-brand-900 disabled:from-brand-600/50 disabled:to-brand-700/50 disabled:shadow-none',
  secondary:
    'bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-raised ring-1 ring-inset ring-white/10 hover:to-slate-950 active:to-black',
  outline:
    'border border-slate-300 bg-white text-slate-800 shadow-xs hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  danger:
    'bg-gradient-to-b from-danger-600 to-danger-700 text-white shadow-raised ring-1 ring-inset ring-white/10 hover:to-danger-700 active:to-danger-700 disabled:opacity-50',
  success:
    'bg-gradient-to-b from-success-600 to-success-700 text-white shadow-raised ring-1 ring-inset ring-white/10 hover:to-success-700 active:to-success-700 disabled:opacity-50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-sm',
  md: 'h-11 gap-2 px-4.5 text-[0.9375rem]',
  lg: 'h-[3.25rem] gap-2 px-7 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Buong lapad sa mobile, auto sa desktop — madalas gamitin sa form. */
  block?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    block = false,
    iconLeft,
    iconRight,
    disabled,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-input font-semibold',
        'transition-all duration-150 ease-out active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        iconLeft && <span className="shrink-0">{iconLeft}</span>
      )}
      <span className="truncate">{children}</span>
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  )
})
