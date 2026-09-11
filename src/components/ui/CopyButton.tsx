import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { useT } from '@/hooks/useT'

/**
 * Pindutang kumokopya sa clipboard, may saglit na "Nakopya" na feedback.
 * Hindi nagsasabing nakopya kung hinarang ng browser ang clipboard.
 */
export function CopyButton({
  text,
  label,
  icon,
  variant = 'outline',
  ...rest
}: {
  text: string
  label?: string
  /** Palitan ang default na Copy icon (hal. Link). */
  icon?: ReactNode
} & Omit<ButtonProps, 'onClick' | 'iconLeft' | 'children'>) {
  const { t } = useT()
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      setDone(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={copy}
      iconLeft={done ? <Check className="size-4" /> : (icon ?? <Copy className="size-4" />)}
      {...rest}
    >
      {done ? t('properties.copied') : (label ?? t('common.copy'))}
    </Button>
  )
}
