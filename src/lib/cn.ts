import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Pinagsasama ang conditional classes at inaayos ang Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
