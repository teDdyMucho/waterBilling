/**
 * Formatting helpers.
 *
 * PANUNTUNAN SA PERA: sa buong app, ang halaga ay iniimbak at kinukuwenta
 * bilang INTEGER CENTAVOS. Dito lang, sa display layer, ito ginagawang piso.
 * Iwas ito sa floating-point error tulad ng 0.1 + 0.2 !== 0.3.
 */

/** 125050 (centavos) -> "₱1,250.50" */
export function peso(centavos: number | null | undefined): string {
  const value = (centavos ?? 0) / 100
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** 125050 -> "1,250.50" (walang simbolo, pang-table) */
export function pesoPlain(centavos: number | null | undefined): string {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((centavos ?? 0) / 100)
}

/**
 * Nagfo-format ng PISO na numeric (hindi centavos) — ito ang ginagamit
 * ng bills/rates dahil numeric(12,2) pesos ang imbak sa DB.
 * 1250.5 -> "₱1,250.50"
 */
export function money(pesos: number | null | undefined): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos ?? 0)
}

/** "1250.50" o 1250.5 -> 125050 centavos */
export function toCentavos(pesoValue: string | number): number {
  const n = typeof pesoValue === 'string' ? parseFloat(pesoValue || '0') : pesoValue
  return Math.round((Number.isFinite(n) ? n : 0) * 100)
}

export type Utility = 'water' | 'electric'

/** Sukat ng konsumo: tubig = m³, kuryente = kWh */
export function consumption(value: number | null | undefined, utility: Utility): string {
  const n = value ?? 0
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
  return utility === 'water' ? `${formatted} m³` : `${formatted} kWh`
}

export const UTILITY_UNIT: Record<Utility, string> = {
  water: 'm³',
  electric: 'kWh',
}

/** Reading sa metro — laging naka-pad sa bilang ng digit ng metro. */
export function meterReading(value: number | null | undefined, digits = 5): string {
  return String(Math.trunc(value ?? 0)).padStart(digits, '0')
}

export function shortDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function longDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function dateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

/** "3 days left" / "2 days overdue" — para sa due date countdown. */
export function daysUntil(date: string | Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** Blk 5 Lot 12 */
export function lotLabel(block?: string | null, lot?: string | null): string {
  if (!block && !lot) return '—'
  return `Blk ${block ?? '—'} Lot ${lot ?? '—'}`
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** 0.1834 -> "+18.3%" */
export function percentDelta(ratio: number): string {
  const sign = ratio > 0 ? '+' : ''
  return `${sign}${(ratio * 100).toFixed(1)}%`
}
