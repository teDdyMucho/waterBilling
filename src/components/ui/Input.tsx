import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  iconLeft?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, iconLeft, suffix, id, required, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="ml-0.5 text-danger-600">*</span>}
        </label>
      )}

      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error || hint ? `${inputId}-desc` : undefined}
          className={cn(
            // h-11 = 44px tap target sa mobile
            'h-11 w-full rounded-input border bg-white px-3 text-slate-900 shadow-card',
            'placeholder:text-slate-400',
            'transition-colors duration-150 focus:outline-none',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
            iconLeft && 'pl-10',
            suffix && 'pr-14',
            error
              ? 'border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-100'
              : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100',
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
            {suffix}
          </span>
        )}
      </div>

      {(error || hint) && (
        <p
          id={`${inputId}-desc`}
          className={cn('mt-1.5 text-sm', error ? 'text-danger-600' : 'text-slate-500')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
})
