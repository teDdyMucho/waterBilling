import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

/** Segmented EN / TL switch. Maliit pero laging abot-kamay. */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useT()

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={cn(
        'inline-flex shrink-0 rounded-full border border-slate-300 bg-white p-0.5',
        className,
      )}
    >
      {(['tl', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cn(
            'min-h-0 rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors duration-150',
            locale === code
              ? 'bg-brand-700 text-white'
              : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
