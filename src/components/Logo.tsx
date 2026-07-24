import { cn } from '@/lib/cn'

/**
 * Marka ng Santa Cicilia Subdivision.
 * Konsepto: patak ng tubig + kidlat ng kuryente sa loob ng isang bahay.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('size-8', className)}
    >
      <rect width="32" height="32" rx="8" className="fill-brand-700" />
      {/* bubong */}
      <path
        d="M6.5 15.2 16 7.5l9.5 7.7"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* patak ng tubig */}
      <path
        d="M12.4 17.2c0-1.7 2.3-4 2.3-4s2.3 2.3 2.3 4a2.3 2.3 0 1 1-4.6 0Z"
        className="fill-water-100"
      />
      {/* kidlat */}
      <path
        d="M19.8 15.6h2.9l-2.2 3.1h2l-3.6 5 .9-3.6h-1.8l1.8-4.5Z"
        className="fill-power-500"
      />
    </svg>
  )
}

export function Logo({
  className,
  subdivision,
  tagline,
}: {
  className?: string
  subdivision: string
  tagline: string
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <LogoMark className="size-9 shrink-0" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[0.9375rem] font-semibold text-slate-900">
          {subdivision}
        </span>
        <span className="truncate text-xs text-slate-500">{tagline}</span>
      </span>
    </span>
  )
}
