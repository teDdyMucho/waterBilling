import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/Logo'
import { useT } from '@/hooks/useT'

export default function NotFoundPage() {
  const { t } = useT()
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-slate-50 px-4 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid mask-fade-b absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 -top-32 h-80 bg-[radial-gradient(40rem_22rem_at_50%_0%,var(--color-brand-100),transparent_70%)]" />
      </div>
      <div className="relative max-w-sm">
        <LogoMark className="mx-auto size-12" />
        <p className="tabular mt-6 text-5xl font-bold text-slate-300">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          Wala sa portal ang page na ito
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Baka nabago ang link o hindi na ito gamit.
        </p>
        <Link to="/" className="mt-6 block">
          <Button block iconLeft={<ArrowLeft className="size-4" />}>
            {t('common.backToHome')}
          </Button>
        </Link>
      </div>
    </div>
  )
}
