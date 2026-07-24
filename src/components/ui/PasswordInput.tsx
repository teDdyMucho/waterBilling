import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, label, hint, error, id, required, ...props }, ref) {
    const autoId = useId()
    const inputId = id ?? autoId
    const [show, setShow] = useState(false)

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
            {label}
            {required && <span className="ml-0.5 text-danger-600">*</span>}
          </label>
        )}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Lock className="size-4" />
          </span>
          <input
            ref={ref}
            id={inputId}
            type={show ? 'text' : 'password'}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error || hint ? `${inputId}-desc` : undefined}
            className={cn(
              'h-11 w-full rounded-input border bg-white pl-10 pr-11 text-slate-900 shadow-xs',
              'placeholder:text-slate-400 focus:outline-none',
              'transition-colors duration-150',
              error
                ? 'border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-100'
                : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Itago ang password' : 'Ipakita ang password'}
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
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
  },
)
