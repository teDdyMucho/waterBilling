import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Native select na naka-istilo ayon sa design system. */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, id, required, children, ...props },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-danger-600">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        required={required}
        className={cn(
          'h-11 w-full appearance-none rounded-input border bg-white bg-[length:1.25rem] bg-[right_0.65rem_center] bg-no-repeat px-3 pr-9 text-slate-900 shadow-xs',
          "bg-[url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3e%3c/svg%3e\")]",
          'focus:outline-none transition-colors duration-150',
          error
            ? 'border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-100'
            : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1.5 text-sm text-danger-600">{error}</p>}
    </div>
  )
})

/** Simpleng checkbox na may label — para sa consent, terms, atbp. */
export function Checkbox({
  label,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  const autoId = useId()
  const cbId = id ?? autoId
  return (
    <label htmlFor={cbId} className={cn('flex cursor-pointer items-start gap-2.5', className)}>
      <input
        id={cbId}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-2 focus:ring-brand-200 focus:ring-offset-0"
        {...props}
      />
      <span className="text-sm leading-relaxed text-slate-600">{label}</span>
    </label>
  )
}
