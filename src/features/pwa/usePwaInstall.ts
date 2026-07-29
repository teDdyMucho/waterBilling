import { useEffect, useReducer } from 'react'
import {
  canInstall,
  dismissInstall,
  isInstallDismissed,
  isIOS,
  isInstalled,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from './install'

/**
 * React binding sa install-state singleton. Nagre-render kapag nagbago ang
 * pagkaka-available ng install prompt (o kapag na-install / na-dismiss).
 */
export function usePwaInstall() {
  const [, force] = useReducer((x: number) => x + 1, 0)

  useEffect(() => subscribeInstall(force), [])

  const standalone = isStandalone()
  const ios = isIOS()

  return {
    /** May native na prompt na pwedeng ipakita (Android/desktop Chrome/Edge). */
    canInstall: canInstall(),
    /** Na-install na ngayong session (appinstalled). */
    installed: isInstalled(),
    /** Tumatakbo na bilang naka-install na app. */
    isStandalone: standalone,
    /** iOS — kailangan ng manual na "Add to Home Screen". */
    isIOS: ios,
    /** Sa iOS, ipakita ang instruksyon sa halip na button. */
    needsIOSInstructions: ios && !standalone,
    dismissed: isInstallDismissed(),
    promptInstall,
    dismiss: dismissInstall,
  }
}
