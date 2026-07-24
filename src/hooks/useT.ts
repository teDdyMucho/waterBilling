import { useContext } from 'react'
import { I18nContext } from '@/i18n/I18nProvider'

/** t('landing.heroTitle') · locale · setLocale */
export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx
}
