import { Loader2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-700', className)} />
}

/** Buong-screen na loader — para sa auth boot at route transitions. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <LogoMark className="size-12" />
          <span className="absolute -inset-2 animate-ping rounded-2xl bg-brand-500/20" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="size-4" />
          {label ?? 'Loading…'}
        </div>
      </div>
    </div>
  )
}
