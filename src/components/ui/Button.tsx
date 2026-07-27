import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  // Solid near-black — pangunahing aksyon
  primary:
    'bg-brand-700 text-white shadow-brand ring-1 ring-inset ring-white/10 hover:bg-brand-600 active:bg-brand-800 disabled:bg-brand-700/50 disabled:shadow-none',
  // Positive confirm — solid, bahagyang mas madilim
  success:
    'bg-brand-800 text-white shadow-raised ring-1 ring-inset ring-white/10 hover:bg-brand-700 active:bg-brand-900 disabled:opacity-50',
  // Soft gray fill
  secondary:
    'bg-slate-100 text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-200 active:bg-slate-300',
  // Outline sa puti
  outline:
    'border border-slate-300 bg-white text-slate-800 shadow-xs hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  // Destructive — outline na pumupuno ng itim sa hover (may confirm + icon)
  danger:
    'border border-slate-300 bg-white text-slate-900 shadow-xs hover:border-brand-700 hover:bg-brand-700 hover:text-white active:bg-brand-800 disabled:opacity-50',
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
