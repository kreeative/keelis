/**
 * Crypto-area helpers: compact large numbers (« 2,83 T$ », « 48,0 G$ »),
 * range / frequency labels, keypad conversions, address abbreviation.
 * Every number still goes through @/lib/format (Intl) — nothing is formatted by hand.
 */
import type { ChartRange, RecurringFrequency } from '@/api/types'
import { formatMoney, formatNumber, type Locale } from '@/lib/format'

const NBSP = ' '

const UNITS: Record<Locale, ReadonlyArray<readonly [number, string]>> = {
  'fr-CA': [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
  ],
  'en-CA': [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ],
}

function scale(value: number, locale: Locale): { n: string; unit: string } | null {
  const abs = Math.abs(value)
  const hit = UNITS[locale].find(([threshold]) => abs >= threshold)
  if (!hit) return null
  const scaled = value / hit[0]
  const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2
  return { n: formatNumber(scaled, { locale, minFraction: digits, maxFraction: digits }), unit: hit[1] }
}

/** 2 830 000 000 000 → « 2,83 T$ » (fr-CA) / « $2.83T » (en-CA). Below 1 000 falls back to formatMoney. */
export function formatCompactMoney(value: number, locale: Locale): string {
  const s = scale(value, locale)
  if (!s) return formatMoney(value, { locale })
  return locale === 'fr-CA' ? `${s.n}${NBSP}${s.unit}$` : `$${s.n}${s.unit}`
}

/** 19 820 000 + BTC → « 19,82 M BTC » (fr-CA) / « 19.82M BTC » (en-CA). */
export function formatCompactQuantity(value: number, symbol: string, locale: Locale): string {
  const s = scale(value, locale)
  if (!s) return `${formatNumber(value, { locale, maxFraction: 0 })}${NBSP}${symbol}`
  return locale === 'fr-CA' ? `${s.n}${NBSP}${s.unit}${NBSP}${symbol}` : `${s.n}${s.unit}${NBSP}${symbol}`
}

/** Percent shown as a rate (« 1,50 % »), from a fraction (0.015). */
export function formatRate(fraction: number, locale: Locale): string {
  return `${formatNumber(fraction * 100, { locale, minFraction: 2, maxFraction: 2 })}${NBSP}%`
}

/** Short day + month, year only when it differs from the current one: « 13 sept. » / « Sep 13 ». */
export function formatShortDate(d: string | number | Date, locale: Locale, now = new Date()): string {
  const date = d instanceof Date ? d : new Date(d)
  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat(locale, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

// ---------- Ranges ----------

export const RANGES: ReadonlyArray<{ value: ChartRange; label: string; period: string }> = [
  { value: '1D', label: '1J', period: '1 J' },
  { value: '1W', label: '1S', period: '1 S' },
  { value: '1M', label: '1M', period: '1 M' },
  { value: '1Y', label: '1A', period: '1 A' },
  { value: 'MAX', label: 'Max', period: 'Max' },
]

export function rangePeriod(range: ChartRange): string {
  return RANGES.find((r) => r.value === range)?.period ?? range
}

// ---------- Recurring ----------

export interface FrequencyMeta {
  /** Segment label */
  short: string
  /** Sentence form: « Chaque semaine » */
  sentence: string
  /** Executions per month, for the monthly total */
  perMonth: number
  /** Days between executions (mirrors the API's scheduling) */
  days: number
}

export const FREQUENCIES: Record<RecurringFrequency, FrequencyMeta> = {
  daily: { short: 'Quotidien', sentence: 'Chaque jour', perMonth: 30, days: 1 },
  weekly: { short: 'Hebdo', sentence: 'Chaque semaine', perMonth: 4.33, days: 7 },
  biweekly: { short: '2 sem.', sentence: 'Toutes les 2 semaines', perMonth: 2.17, days: 14 },
  monthly: { short: 'Mensuel', sentence: 'Chaque mois', perMonth: 1, days: 30 },
}

export const FREQUENCY_ORDER: ReadonlyArray<RecurringFrequency> = ['daily', 'weekly', 'biweekly', 'monthly']

/** Sum of active recurring amounts normalised to a month. */
export function monthlyTotal(items: ReadonlyArray<{ amount: number; frequency: RecurringFrequency; active: boolean }>): number {
  return items.reduce((sum, r) => (r.active ? sum + r.amount * FREQUENCIES[r.frequency].perMonth : sum), 0)
}

// ---------- Keypad ----------

/** Number → keypad string ("0,0007"); trailing zeros trimmed; 0 or invalid → "". */
export function toKeypadRaw(value: number, maxDecimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  let s = value.toFixed(Math.max(0, Math.min(20, maxDecimals)))
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  if (s === '0' || s === '') return ''
  return s.replace('.', ',')
}

/** Round down to a number of decimals (never overshoots a balance). */
export function floorTo(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.floor(value * f + 1e-9) / f
}

// ---------- Addresses ----------

/** bc1qxy…k7f2 — first 6 + last 4 characters. */
export function abbreviateAddress(address: string): string {
  const a = address.trim()
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
