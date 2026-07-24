import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from '@/locales/en.json'
import tl from '@/locales/tl.json'

export type Locale = 'en' | 'tl'

type Dict = Record<string, unknown>

const DICTS: Record<Locale, Dict> = { en, tl }

const STORAGE_KEY = 'scs-locale'

/** Default ay Tagalog — karamihan ng residente ay mas komportable dito. */
const DEFAULT_LOCALE: Locale = 'tl'

type I18nValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

function lookup(dict: Dict, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Dict)) {
      return (acc as Dict)[part]
    }
    return undefined
  }, dict)
  return typeof value === 'string' ? value : undefined
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'en' || saved === 'tl' ? saved : DEFAULT_LOCALE
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((l: Locale) => setLocaleState(l), [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Fallback sa English kung wala pang salin, tapos sa key mismo.
      const raw = lookup(DICTS[locale], key) ?? lookup(DICTS.en, key) ?? key
      if (!vars) return raw
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        raw,
      )
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
