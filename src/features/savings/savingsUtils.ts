/**
 * Pure helpers for the Épargne area: goal maths and the « mois année » label.
 * No formatting of raw numbers here — amounts always go through @/lib/format.
 */
import { MASKED, formatMoney, formatNumber, type Locale, type MoneyOptions } from '@/lib/format'

/** « avril 2027 » (fr-CA) — used for goal completion estimates. */
export function formatMonthYear(d: Date | string | number, locale: Locale): string {
  const date = d instanceof Date ? d : new Date(d)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
}

/** Months still needed to reach the target. 0 = already reached, null = never (no contribution). */
export function monthsToTarget(target: number, current: number, monthly: number): number | null {
  const remaining = target - current
  if (remaining <= 0) return 0
  if (!(monthly > 0)) return null
  return Math.ceil(remaining / monthly)
}

/** First day of the month `months` from now. */
export function dateInMonths(months: number, from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + months, 1)
}

/** 0..1 */
export function goalProgress(current: number, target: number): number {
  if (!(target > 0)) return 0
  return Math.max(0, Math.min(1, current / target))
}

/** Whole-percent progress, for copy such as « 53 % ». */
export function goalPercent(current: number, target: number): number {
  return Math.round(goalProgress(current, target) * 100)
}

/** Simple interest projection used in the deposit preview (APY in percent). */
export function estimateInterest(amount: number, apy: number, months = 12): number {
  if (!(amount > 0) || !(apy > 0)) return 0
  return (amount * (apy / 100) * months) / 12
}

/** Part of the savings balance that is not attached to a goal. */
export function unallocated(balance: number | undefined, goals: Array<{ current: number }> | undefined): number | undefined {
  if (balance === undefined || goals === undefined) return undefined
  return Math.max(0, balance - goals.reduce((s, g) => s + g.current, 0))
}

/**
 * A money amount inside a sentence (a caption, a meta line). <Money> cannot be used
 * there, so the privacy mask has to be applied by hand — never format the number itself.
 */
export function inlineMoney(value: number, hidden: boolean, opts: MoneyOptions = {}): string {
  return hidden ? MASKED : formatMoney(value, opts)
}

// ---------- Percentages ----------

const NBSP = ' '

/** « 4,00 % » — the APY badge (always two decimals). */
export function formatApy(apy: number, locale: Locale): string {
  return `${formatNumber(apy, { locale, minFraction: 2, maxFraction: 2 })}${NBSP}%`
}

/** « 53 % » — goal progress (whole percent). */
export function formatWholePercent(value: number, locale: Locale): string {
  return `${formatNumber(value, { locale, maxFraction: 0 })}${NBSP}%`
}

// ---------- Keypad ----------

/** Number → keypad string ("1250,5"); trailing zeros trimmed; 0 or invalid → "". */
export function toKeypadRaw(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  let s = value.toFixed(Math.max(0, Math.min(20, maxDecimals)))
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  if (s === '0' || s === '') return ''
  return s.replace('.', ',')
}

/** Round down to a number of decimals (never overshoots a balance). */
export function floorTo(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.floor(value * f + 1e-9) / f
}

/** Keep only digits and one decimal separator (max two decimals) while typing in a Field. */
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/\./g, ',')
  const [int = '', ...rest] = cleaned.split(',')
  if (!rest.length) return int
  return `${int},${rest.join('').slice(0, 2)}`
}
